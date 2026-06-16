#!/usr/bin/env bash
#
# sync-upstream.sh
#
# Syncs the fork with the upstream repository, keeping fork-specific commits
# (CI, config, etc.) on top of the latest upstream history.
#
#   1. Fetches `upstream` (never pushes to it).
#   2. Rebases `main` onto `upstream/main`  -> fork commits land on top of upstream.
#   3. Rebases `stage` and `dev` onto the freshly-updated `main`.
#
# By default nothing is pushed. Pass --push to force-push the rebased branches
# to `origin` (uses --force-with-lease for safety). It never touches upstream.
#
# Usage:
#   scripts/sync-upstream.sh            # rebase locally only
#   scripts/sync-upstream.sh --push     # rebase + push to origin
#
set -euo pipefail

# --- config ---------------------------------------------------------------
UPSTREAM_REMOTE="upstream"
ORIGIN_REMOTE="origin"
MAIN_BRANCH="main"
DOWNSTREAM_BRANCHES=("stage" "dev")

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

# --- args -----------------------------------------------------------------
PUSH=false
for arg in "$@"; do
  case "$arg" in
    --push) PUSH=true ;;
    -h|--help)
      sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

# --- preflight ------------------------------------------------------------
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repository."

git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1 || die "Remote '$UPSTREAM_REMOTE' not configured."
git remote get-url "$ORIGIN_REMOTE"   >/dev/null 2>&1 || die "Remote '$ORIGIN_REMOTE' not configured."

if [[ -n "$(git status --porcelain)" ]]; then
  die "Working tree is not clean. Commit or stash your changes first."
fi

ORIGINAL_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
restore() {
  # Best-effort return to the branch you started on.
  git rebase --abort >/dev/null 2>&1 || true
  if [[ "$(git rev-parse --abbrev-ref HEAD 2>/dev/null)" != "$ORIGINAL_BRANCH" ]]; then
    git checkout "$ORIGINAL_BRANCH" >/dev/null 2>&1 || true
  fi
}
trap restore EXIT

# --- fetch upstream -------------------------------------------------------
info "Fetching ${UPSTREAM_REMOTE} (prune)..."
git fetch --prune "$UPSTREAM_REMOTE"
ok "Fetched ${UPSTREAM_REMOTE}."

# --- rebase main onto upstream/main --------------------------------------
info "Rebasing ${MAIN_BRANCH} onto ${UPSTREAM_REMOTE}/${MAIN_BRANCH}..."
git checkout "$MAIN_BRANCH"
if ! git rebase "${UPSTREAM_REMOTE}/${MAIN_BRANCH}"; then
  die "Rebase of ${MAIN_BRANCH} hit conflicts. Resolve them, run 'git rebase --continue', then re-run with --push if needed."
fi
ok "${MAIN_BRANCH} is up to date with ${UPSTREAM_REMOTE}/${MAIN_BRANCH}."

# --- rebase downstream branches onto main --------------------------------
for branch in "${DOWNSTREAM_BRANCHES[@]}"; do
  if ! git show-ref --verify --quiet "refs/heads/${branch}"; then
    warn "Local branch '${branch}' not found — skipping."
    continue
  fi
  info "Rebasing ${branch} onto ${MAIN_BRANCH}..."
  git checkout "$branch"
  if ! git rebase "$MAIN_BRANCH"; then
    die "Rebase of ${branch} hit conflicts. Resolve them, run 'git rebase --continue', then re-run with --push if needed."
  fi
  ok "${branch} rebased onto ${MAIN_BRANCH}."
done

# --- optional push to origin ---------------------------------------------
if [[ "$PUSH" == true ]]; then
  echo
  warn "Rebasing rewrote history; pushing to ${ORIGIN_REMOTE} requires a force push."
  read -r -p "Force-push ${MAIN_BRANCH} ${DOWNSTREAM_BRANCHES[*]} to ${ORIGIN_REMOTE}? [y/N] " reply
  if [[ "$reply" =~ ^[Yy]$ ]]; then
    for branch in "$MAIN_BRANCH" "${DOWNSTREAM_BRANCHES[@]}"; do
      git show-ref --verify --quiet "refs/heads/${branch}" || continue
      info "Pushing ${branch} -> ${ORIGIN_REMOTE}..."
      git push --force-with-lease "$ORIGIN_REMOTE" "$branch"
      ok "Pushed ${branch}."
    done
  else
    warn "Skipped pushing to ${ORIGIN_REMOTE}."
  fi
else
  echo
  info "Local branches updated. Re-run with --push to push to ${ORIGIN_REMOTE}."
fi

# restore handled by trap
echo
ok "Sync complete."
