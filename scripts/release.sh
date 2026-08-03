#!/usr/bin/env bash
#
# Release helper for the monorepo's independently-versioned packages.
#
#   scripts/release.sh airgen <patch|minor|major|x.y.z>
#   scripts/release.sh ui     <patch|minor|major|x.y.z>
#
# Bumps the package version, syncs the lockfile, runs that package's checks,
# verifies the changelog has an entry for the new version, commits, and
# creates the package-prefixed tag (airgen@x.y.z / @airgen/ui@x.y.z).
# Nothing is pushed or published — the exact commands are printed at the end.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

usage() {
  echo "usage: scripts/release.sh <airgen|ui> <patch|minor|major|x.y.z>" >&2
  exit 1
}

[ $# -eq 2 ] || usage
PKG="$1"
BUMP="$2"

case "$PKG" in
  airgen)
    PKG_NAME="airgen"
    PKG_DIR="."
    CHANGELOG="CHANGELOG.md"
    ;;
  ui)
    PKG_NAME="@airgen/ui"
    PKG_DIR="packages/ui"
    CHANGELOG="packages/ui/CHANGELOG.md"
    ;;
  *) usage ;;
esac

fail() {
  echo "error: $1" >&2
  exit 1
}

# --- preflight -------------------------------------------------------------

[ -z "$(git status --porcelain)" ] || fail "working tree is not clean — commit or stash first"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "main" ] || fail "on branch '$BRANCH' — releases are cut from main"

# --- bump ------------------------------------------------------------------

if [ "$PKG" = "airgen" ]; then
  npm version "$BUMP" --no-git-tag-version >/dev/null
else
  npm version "$BUMP" --workspace "$PKG_NAME" >/dev/null
fi

VERSION="$(node -p "require('./$PKG_DIR/package.json').version")"
TAG="$PKG_NAME@$VERSION"

if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  git checkout -- . >/dev/null
  fail "tag $TAG already exists"
fi

# keep package-lock.json in sync with the bumped manifest
npm install --package-lock-only >/dev/null 2>&1

echo "==> $PKG_NAME $VERSION"

# --- changelog gate --------------------------------------------------------

if ! grep -q "^## \[$VERSION\]" "$CHANGELOG"; then
  git checkout -- . >/dev/null
  fail "$CHANGELOG has no '## [$VERSION]' section — write the changelog entry first (version bump was rolled back)"
fi

# --- checks ----------------------------------------------------------------

echo "==> running $PKG_NAME checks"
if [ "$PKG" = "airgen" ]; then
  npm test
else
  npm run build --workspace "$PKG_NAME"
  npm test --workspace "$PKG_NAME"
  npm run check:react17 --workspace "$PKG_NAME"
fi

# --- commit + tag ----------------------------------------------------------

git add package.json package-lock.json "$PKG_DIR/package.json"
git commit -m "Release $TAG"
git tag "$TAG"

echo
echo "==> released $TAG"
echo
echo "next steps:"
echo "  git push origin main $TAG"
if [ "$PKG" = "airgen" ]; then
  echo "  npm publish"
else
  PRIVATE="$(node -p "require('./$PKG_DIR/package.json').private === true")"
  if [ "$PRIVATE" = "true" ]; then
    echo "  (@airgen/ui is still private — no publish until 0.1.0/Phase 8)"
  else
    echo "  npm publish --workspace $PKG_NAME"
  fi
fi
