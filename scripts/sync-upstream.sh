#!/usr/bin/env bash
#
# sync-upstream.sh
#
# Syncs the fork with the upstream repository, keeping fork-specific commits
# (Vero auth, vendors, CI, config, etc.) on top of the latest upstream history.
#
#   1. Fetches `upstream` and `origin`. Never pushes to upstream (its push URL
#      is disabled locally).
#   2. On a fresh sync: refuses to start if a local branch is missing commits
#      from origin, backs up main/stage/dev as backup/pre-sync-<stamp>/<branch>,
#      and records the sync state in .git/sync-upstream.state.
#   3. Rebases `main` onto `upstream/main` -> fork commits land on top of upstream.
#   4. Rebases `stage` and `dev` onto the new `main` with `--onto`, replaying only
#      their own commits — never the pre-rebase copies of main's commits.
#
# The sync is resumable. When a rebase stops on conflicts, resolve them, finish
# with `git rebase --continue`, and re-run the script: it picks up where it left
# off without re-hitting conflicts you already resolved.
#
# Nothing is pushed by default. --push force-pushes the rebased branches to
# `origin` with a lease pinned to the origin tips seen when the sync started, so
# commits someone else pushed in the meantime are never overwritten.
#
# Usage:
#   scripts/sync-upstream.sh               # rebase locally (or resume)
#   scripts/sync-upstream.sh --push        # rebase (or resume) + push to origin
#   scripts/sync-upstream.sh --push --yes  # ...without the confirmation prompt
#   scripts/sync-upstream.sh --fresh       # discard saved sync state, start over
#
set -euo pipefail

# --- config ---------------------------------------------------------------
UPSTREAM_REMOTE="upstream"
ORIGIN_REMOTE="origin"
MAIN_BRANCH="main"
DOWNSTREAM_BRANCHES=("stage" "dev")
DISABLED_PUSH_URL="DISABLED_no_push_to_spree_upstream"

# --- colours --------------------------------------------------------------
if [[ -t 1 ]]; then
  C_BLUE="\033[1;34m"; C_GREEN="\033[1;32m"; C_RED="\033[1;31m"; C_YELLOW="\033[1;33m"; C_RESET="\033[0m"
else
  C_BLUE=""; C_GREEN=""; C_RED=""; C_YELLOW=""; C_RESET=""
fi
info()  { echo -e "${C_BLUE}==>${C_RESET} $*"; }
ok()    { echo -e "${C_GREEN}✓${C_RESET} $*"; }
warn()  { echo -e "${C_YELLOW}!${C_RESET} $*"; }
die()   { echo -e "${C_RED}✗ $*${C_RESET}" >&2; exit 1; }

usage() {
  awk 'NR > 1 && /^#/ { sub(/^# ?/, ""); print; next } NR > 1 { exit }' "$0"
}

# --- args -----------------------------------------------------------------
PUSH=false
ASSUME_YES=false
FRESH=false
for arg in "$@"; do
  case "$arg" in
    --push) PUSH=true ;;
    --yes|-y) ASSUME_YES=true ;;
    --fresh) FRESH=true ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

# --- preflight ------------------------------------------------------------
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repository."

git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1 || die "Remote '$UPSTREAM_REMOTE' not configured."
git remote get-url "$ORIGIN_REMOTE"   >/dev/null 2>&1 || die "Remote '$ORIGIN_REMOTE' not configured."

REBASE_MERGE_DIR="$(git rev-parse --git-path rebase-merge)"
REBASE_APPLY_DIR="$(git rev-parse --git-path rebase-apply)"
rebase_in_progress() { [[ -d "$REBASE_MERGE_DIR" || -d "$REBASE_APPLY_DIR" ]]; }

if rebase_in_progress; then
  rebasing="$(sed 's#^refs/heads/##' "$REBASE_MERGE_DIR/head-name" 2>/dev/null || echo "a branch")"
  die "A rebase of '${rebasing}' is still in progress.
  Finish it (resolve, git add <files>, git rebase --continue) or abort it
  (git rebase --abort), then re-run this script."
fi

if [[ -n "$(git status --porcelain)" ]]; then
  die "Working tree is not clean. Commit or stash your changes first."
fi

git show-ref --verify --quiet "refs/heads/${MAIN_BRANCH}" \
  || die "Local branch '${MAIN_BRANCH}' not found."

# Guarantee this repo can never push fork commits to upstream.
if [[ "$(git remote get-url --push "$UPSTREAM_REMOTE")" != "$DISABLED_PUSH_URL" ]]; then
  git remote set-url --push "$UPSTREAM_REMOTE" "$DISABLED_PUSH_URL"
  ok "Disabled pushing to '${UPSTREAM_REMOTE}' (remote.${UPSTREAM_REMOTE}.pushurl)."
fi

# zdiff3 (git >= 2.35) shows the common ancestor in conflict hunks, which makes
# replayed fork commits much easier to resolve; fall back to diff3 on older git.
IFS=. read -r GIT_MAJOR GIT_MINOR _ <<<"$(git version | awk '{ print $3 }')"
if (( GIT_MAJOR > 2 || (GIT_MAJOR == 2 && GIT_MINOR >= 35) )); then
  CONFLICT_STYLE="zdiff3"
else
  CONFLICT_STYLE="diff3"
fi
rebase() { git -c merge.conflictStyle="$CONFLICT_STYLE" rebase "$@"; }

DOWNSTREAM_PRESENT=()
for branch in "${DOWNSTREAM_BRANCHES[@]}"; do
  if git show-ref --verify --quiet "refs/heads/${branch}"; then
    DOWNSTREAM_PRESENT+=("$branch")
  else
    warn "Local branch '${branch}' not found — skipping."
  fi
done
BRANCHES=("$MAIN_BRANCH" ${DOWNSTREAM_PRESENT[@]+"${DOWNSTREAM_PRESENT[@]}"})

ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"

# --- sync state -----------------------------------------------------------
# key=value lines, kept in the common git dir (shared by worktrees, never
# committed). Keys: started, origin.<branch> (origin tip when the sync started,
# empty if the branch wasn't on origin), base.<branch> (the main commit a
# downstream branch is currently built on).
STATE_FILE="$(git rev-parse --git-common-dir)/sync-upstream.state"

state_get() {
  [[ -f "$STATE_FILE" ]] || return 0
  awk -v key="$1=" 'index($0, key) == 1 { value = substr($0, length(key) + 1) } END { printf "%s", value }' "$STATE_FILE"
}

state_set() {
  local tmp="${STATE_FILE}.tmp"
  {
    [[ -f "$STATE_FILE" ]] && awk -v key="$1=" 'index($0, key) != 1' "$STATE_FILE"
    echo "$1=$2"
  } >"$tmp"
  mv "$tmp" "$STATE_FILE"
}

origin_tip() {
  git rev-parse --verify --quiet "refs/remotes/${ORIGIN_REMOTE}/$1" || true
}

short() {
  if [[ -n "$1" ]]; then git rev-parse --short "$1"; else echo "(none)"; fi
}

# Print resolution guidance and exit, LEAVING the rebase in progress so that
# `git status` / `git diff` show the conflicts for you to resolve. We never
# auto-abort a rebase — that would discard the conflict state you need to see.
rebase_conflict() {
  local branch="$1"
  echo
  die "Rebase of '${branch}' hit conflicts. The rebase is still in progress on '${branch}'.

  Resolve it:
    git diff --name-only --diff-filter=U   # conflicted files
    git diff                               # inspect (${CONFLICT_STYLE}: shows the common ancestor)
    # ...edit files, then...
    git add <files>
    git rebase --continue                  # repeat until the rebase finishes

  Then re-run this script with the same flags. It resumes from here and won't
  replay commits you already resolved.

  Or bail out:
    git rebase --abort
  and either re-run later, or undo the whole sync by resetting each branch to
  backup/pre-sync-${SYNC_STAMP}/<branch> and re-running with --fresh."
}

# Only return to the starting branch when the tree is clean (no rebase in
# progress, no leftover conflicts). Never aborts anything.
restore() {
  rebase_in_progress && return 0
  [[ -n "$(git status --porcelain 2>/dev/null)" ]] && return 0
  if [[ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" != "$ORIGINAL_BRANCH" ]]; then
    git checkout "$ORIGINAL_BRANCH" >/dev/null 2>&1 || true
  fi
}
trap restore EXIT

if [[ "$FRESH" == true && -f "$STATE_FILE" ]]; then
  warn "Discarding saved sync state from $(state_get started) (backup branches are kept)."
  rm -f "$STATE_FILE"
fi

# --- fetch ----------------------------------------------------------------
info "Fetching ${UPSTREAM_REMOTE} and ${ORIGIN_REMOTE} (prune)..."
git fetch --prune "$UPSTREAM_REMOTE"
git fetch --prune "$ORIGIN_REMOTE"
ok "Fetched."

# --- start or resume ------------------------------------------------------
if [[ ! -f "$STATE_FILE" ]]; then
  # A later force-push would silently drop origin commits the local branch
  # doesn't have, so they must be brought in before history is rewritten.
  for branch in "${BRANCHES[@]}"; do
    remote="$(origin_tip "$branch")"
    [[ -n "$remote" ]] || continue
    behind="$(git rev-list --count "${branch}..${remote}")"
    if (( behind > 0 )); then
      die "Local '${branch}' is missing ${behind} commit(s) from ${ORIGIN_REMOTE}/${branch}.
  Bring them in first (e.g. git checkout ${branch} && git pull --ff-only), then re-run."
    fi
  done

  SYNC_STAMP="$(date +%Y%m%d-%H%M%S)"
  main_tip="$(git rev-parse "$MAIN_BRANCH")"
  for branch in "${BRANCHES[@]}"; do
    git branch "backup/pre-sync-${SYNC_STAMP}/${branch}" "$branch"
  done

  state_set started "$SYNC_STAMP"
  for branch in "${BRANCHES[@]}"; do
    state_set "origin.${branch}" "$(origin_tip "$branch")"
  done
  for branch in ${DOWNSTREAM_PRESENT[@]+"${DOWNSTREAM_PRESENT[@]}"}; do
    state_set "base.${branch}" "$main_tip"
  done
  ok "Started sync ${SYNC_STAMP}; backed up branches as backup/pre-sync-${SYNC_STAMP}/<branch>."
else
  SYNC_STAMP="$(state_get started)"
  info "Resuming sync ${SYNC_STAMP} (backups: backup/pre-sync-${SYNC_STAMP}/<branch>). Pass --fresh to start over."

  # Rebased branches don't contain commits pushed to origin after the sync
  # started; stop before anything could force-push over them.
  for branch in "${BRANCHES[@]}"; do
    recorded="$(state_get "origin.${branch}")"
    current="$(origin_tip "$branch")"
    if [[ "$recorded" != "$current" ]]; then
      die "${ORIGIN_REMOTE}/${branch} moved since sync ${SYNC_STAMP} started ($(short "$recorded") -> $(short "$current")).
  Those commits are not in your rebased '${branch}'. Inspect them with:
    git log ${recorded:+${recorded}..}${ORIGIN_REMOTE}/${branch}
  Then reset the branches to backup/pre-sync-${SYNC_STAMP}/<branch>, bring the new
  commits in, and re-run with --fresh."
    fi
  done
fi

# --- rebase main onto upstream/main --------------------------------------
info "Rebasing ${MAIN_BRANCH} onto ${UPSTREAM_REMOTE}/${MAIN_BRANCH}..."
git checkout --quiet "$MAIN_BRANCH"
if ! rebase "${UPSTREAM_REMOTE}/${MAIN_BRANCH}"; then
  rebase_conflict "$MAIN_BRANCH"
fi
ok "${MAIN_BRANCH} is up to date with ${UPSTREAM_REMOTE}/${MAIN_BRANCH}."
main_tip="$(git rev-parse "$MAIN_BRANCH")"

# --- rebase downstream branches onto main --------------------------------
# A plain `git rebase main` would treat the pre-rebase copies of main's commits
# as the branch's own and replay them — re-hitting every conflict resolved on
# main. Replaying only <base>..<branch> onto main avoids that.
for branch in ${DOWNSTREAM_PRESENT[@]+"${DOWNSTREAM_PRESENT[@]}"}; do
  if git merge-base --is-ancestor "$MAIN_BRANCH" "$branch"; then
    ok "${branch} is already on top of ${MAIN_BRANCH}."
  else
    base="$(state_get "base.${branch}")"
    if [[ -z "$base" ]]; then
      base="$(git merge-base "$MAIN_BRANCH" "$branch")"
      warn "No recorded base for '${branch}'; using its merge-base with ${MAIN_BRANCH} ($(short "$base"))."
    fi
    own="$(git rev-list --count "${base}..${branch}")"
    info "Rebasing ${branch} onto ${MAIN_BRANCH} (replaying ${own} commit(s) of its own)..."
    if ! rebase --onto "$MAIN_BRANCH" "$base" "$branch"; then
      rebase_conflict "$branch"
    fi
    ok "${branch} rebased onto ${MAIN_BRANCH}."
  fi
  state_set "base.${branch}" "$main_tip"
done

# --- optional push to origin ---------------------------------------------
if [[ "$PUSH" != true ]]; then
  echo
  info "Local branches updated. Verify (pnpm install && pnpm run check && pnpm exec tsc --noEmit && pnpm test),"
  info "then publish with: scripts/sync-upstream.sh --push"
  echo
  ok "Sync ${SYNC_STAMP} rebased locally (state kept until pushed)."
  exit 0
fi

echo
warn "Rebasing rewrote history; publishing requires a force push to ${ORIGIN_REMOTE}:"
for branch in "${BRANCHES[@]}"; do
  echo "    ${branch}: $(short "$(state_get "origin.${branch}")") -> $(short "$branch")"
done
if [[ "$ASSUME_YES" != true ]]; then
  [[ -t 0 ]] || die "No terminal to confirm the push. Re-run with --push --yes."
  read -r -p "Force-push ${BRANCHES[*]} to ${ORIGIN_REMOTE}? [y/N] " reply || reply=""
  if [[ ! "$reply" =~ ^[Yy]$ ]]; then
    warn "Skipped pushing to ${ORIGIN_REMOTE}. State kept; re-run with --push when ready."
    exit 0
  fi
fi

for branch in "${BRANCHES[@]}"; do
  # Pin the lease to the origin tip seen when the sync started (empty = the
  # branch must not exist on origin yet), not whatever was fetched last.
  expected="$(state_get "origin.${branch}")"
  info "Pushing ${branch} -> ${ORIGIN_REMOTE}..."
  git push --force-with-lease="refs/heads/${branch}:${expected}" \
    "$ORIGIN_REMOTE" "refs/heads/${branch}:refs/heads/${branch}"
  state_set "origin.${branch}" "$(git rev-parse "$branch")"
  ok "Pushed ${branch}."
done

rm -f "$STATE_FILE"
echo
ok "Sync ${SYNC_STAMP} complete and pushed (backups kept: backup/pre-sync-${SYNC_STAMP}/<branch>)."
