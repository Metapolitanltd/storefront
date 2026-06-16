#!/usr/bin/env bash
#
# release.sh
#
# Creates and pushes the next deployment tag for the CURRENT branch, which
# triggers the gitops CD pipeline (.github/workflows/gitops-deploy.yml).
#
# Branch -> tag prefix mapping (must match the CD workflow triggers):
#   dev    -> dev-v*.*.*   (development)
#   stage  -> stg-v*.*.*   (staging)
#   main   -> prd-v*.*.*   (production)
#
# It finds the latest existing tag for the current branch's prefix, bumps the
# version by the requested level, shows it, and asks for confirmation before
# creating an annotated tag and pushing it to `origin`.
#
# Usage:
#   scripts/release.sh patch        # 0.0.3 -> 0.0.4
#   scripts/release.sh minor        # 0.0.3 -> 0.1.0
#   scripts/release.sh major        # 0.0.3 -> 1.0.0
#   scripts/release.sh patch --yes  # skip the confirmation prompt
#
set -euo pipefail

# --- config ---------------------------------------------------------------
ORIGIN_REMOTE="origin"

# --- colours --------------------------------------------------------------
if [[ -t 1 ]]; then
  C_BLUE="\033[1;34m"; C_GREEN="\033[1;32m"; C_RED="\033[1;31m"; C_YELLOW="\033[1;33m"; C_BOLD="\033[1m"; C_RESET="\033[0m"
else
  C_BLUE=""; C_GREEN=""; C_RED=""; C_YELLOW=""; C_BOLD=""; C_RESET=""
fi
info()  { echo -e "${C_BLUE}==>${C_RESET} $*"; }
ok()    { echo -e "${C_GREEN}✓${C_RESET} $*"; }
warn()  { echo -e "${C_YELLOW}!${C_RESET} $*"; }
die()   { echo -e "${C_RED}✗ $*${C_RESET}" >&2; exit 1; }

# --- args -----------------------------------------------------------------
LEVEL="${1:-}"
ASSUME_YES=false
shift || true
for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=true ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

case "$LEVEL" in
  major|minor|patch) ;;
  ""|-h|--help)
    echo "Usage: scripts/release.sh <major|minor|patch> [--yes]"
    [[ "$LEVEL" == "" ]] && exit 1 || exit 0 ;;
  *) die "First argument must be one of: major | minor | patch (got '$LEVEL')." ;;
esac

# --- preflight ------------------------------------------------------------
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repository."
git remote get-url "$ORIGIN_REMOTE" >/dev/null 2>&1 || die "Remote '$ORIGIN_REMOTE' not configured."

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
case "$BRANCH" in
  dev)   PREFIX="dev"; ENV_NAME="development" ;;
  stage) PREFIX="stg"; ENV_NAME="staging" ;;
  main)  PREFIX="prd"; ENV_NAME="production" ;;
  *) die "Branch '$BRANCH' has no tag mapping. Switch to dev, stage, or main." ;;
esac

if [[ -n "$(git status --porcelain)" ]]; then
  warn "Working tree is not clean — uncommitted changes will NOT be included in this tag."
fi

# --- find latest tag for this prefix -------------------------------------
info "Refreshing tags from ${ORIGIN_REMOTE}..."
git fetch --tags --quiet "$ORIGIN_REMOTE"

LATEST_TAG="$(git tag -l "${PREFIX}-v[0-9]*.[0-9]*.[0-9]*" \
  | sed "s/^${PREFIX}-v//" \
  | sort -t. -k1,1n -k2,2n -k3,3n \
  | tail -n1 || true)"

if [[ -z "$LATEST_TAG" ]]; then
  CUR_MAJOR=0; CUR_MINOR=0; CUR_PATCH=0
  CURRENT_DISPLAY="(none)"
else
  IFS='.' read -r CUR_MAJOR CUR_MINOR CUR_PATCH <<< "$LATEST_TAG"
  CURRENT_DISPLAY="${PREFIX}-v${LATEST_TAG}"
fi

# --- compute next version -------------------------------------------------
case "$LEVEL" in
  major) NEW_MAJOR=$((CUR_MAJOR + 1)); NEW_MINOR=0;                 NEW_PATCH=0 ;;
  minor) NEW_MAJOR=$CUR_MAJOR;         NEW_MINOR=$((CUR_MINOR + 1)); NEW_PATCH=0 ;;
  patch) NEW_MAJOR=$CUR_MAJOR;         NEW_MINOR=$CUR_MINOR;         NEW_PATCH=$((CUR_PATCH + 1)) ;;
esac
NEW_TAG="${PREFIX}-v${NEW_MAJOR}.${NEW_MINOR}.${NEW_PATCH}"

if git rev-parse -q --verify "refs/tags/${NEW_TAG}" >/dev/null; then
  die "Tag ${NEW_TAG} already exists. Aborting."
fi

# --- summary --------------------------------------------------------------
echo
echo -e "${C_BOLD}  Branch:${C_RESET}   ${BRANCH}  ->  ${ENV_NAME}"
echo -e "${C_BOLD}  Current:${C_RESET}  ${CURRENT_DISPLAY}"
echo -e "${C_BOLD}  Bump:${C_RESET}     ${LEVEL}"
echo -e "${C_BOLD}  New tag:${C_RESET}  ${C_GREEN}${NEW_TAG}${C_RESET}"
echo -e "${C_BOLD}  Commit:${C_RESET}   $(git rev-parse --short HEAD)  $(git log -1 --pretty=%s)"
echo

# --- confirm --------------------------------------------------------------
if [[ "$ASSUME_YES" != true ]]; then
  read -r -p "Create and push ${NEW_TAG} to ${ORIGIN_REMOTE}? This triggers a ${ENV_NAME} deploy. [y/N] " reply
  [[ "$reply" =~ ^[Yy]$ ]] || { warn "Aborted. No tag created."; exit 0; }
fi

# --- tag & push -----------------------------------------------------------
info "Creating annotated tag ${NEW_TAG}..."
git tag -a "$NEW_TAG" -m "Release ${NEW_TAG} (${ENV_NAME})"

info "Pushing ${NEW_TAG} -> ${ORIGIN_REMOTE}..."
if ! git push "$ORIGIN_REMOTE" "$NEW_TAG"; then
  git tag -d "$NEW_TAG" >/dev/null 2>&1 || true
  die "Push failed. Local tag removed so you can retry."
fi

ok "Released ${NEW_TAG}. CD pipeline will deploy to ${ENV_NAME}."
