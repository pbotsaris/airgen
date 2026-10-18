#!/usr/bin/env bash
#
# Pack the local airgen and/or @airgen/ui and install them into sandbox/.
#
#   scripts/sandbox.sh          # both packages
#   scripts/sandbox.sh airgen   # just airgen
#   scripts/sandbox.sh ui       # just @airgen/ui
#   scripts/sandbox.sh --watch [airgen|ui]   # then keep the sandbox live
#
# Tarballs land in sandbox/vendor/ under fixed names (airgen.tgz,
# airgen-ui.tgz), so the sandbox's package.json points at the same file
# every time and no version bump is ever needed. Each run builds, packs
# (exactly what npm publish would ship, `files` allowlist included), and
# reinstalls the fresh tarball. Nothing is committed, tagged or published.
#
# --watch then hands off to scripts/sandbox-watch.mjs, which recompiles on
# change and copies the output into sandbox/node_modules, where `block run`
# picks it up and live-reloads.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SANDBOX="$ROOT/sandbox"
VENDOR="$SANDBOX/vendor"

usage() {
  echo "usage: scripts/sandbox.sh [--watch] [airgen|ui|all]" >&2
  exit 1
}

WATCH=0
if [ "${1:-}" = "--watch" ]; then
  WATCH=1
  shift
fi

[ $# -le 1 ] || usage
TARGET="${1:-all}"
case "$TARGET" in
  airgen | ui | all) ;;
  *) usage ;;
esac

[ -f "$SANDBOX/package.json" ] || {
  echo "error: no sandbox at $SANDBOX" >&2
  exit 1
}

mkdir -p "$VENDOR"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

cd "$ROOT"

# pack <npm pack args...> <dest name>: packs into $STAGE, moves the single
# tarball to its fixed name in vendor/.
pack() {
  local dest="${!#}"
  npm pack --loglevel warn --pack-destination "$STAGE" "${@:1:$#-1}" >/dev/null
  mv "$STAGE"/*.tgz "$VENDOR/$dest"
  echo "    -> sandbox/vendor/$dest"
}

INSTALL=()

if [ "$TARGET" != "ui" ]; then
  echo "==> building + packing airgen"
  npm run build >/dev/null # airgen has no prepack; dist/ must be fresh
  pack airgen.tgz
  INSTALL+=("./vendor/airgen.tgz")
fi

if [ "$TARGET" != "airgen" ]; then
  echo "==> building + packing @airgen/ui"
  pack --workspace @airgen/ui airgen-ui.tgz # its prepack runs the build
  INSTALL+=("./vendor/airgen-ui.tgz")
fi

echo "==> installing into sandbox"
cd "$SANDBOX"
# Drop the installed copies first: same path, new contents, and npm can
# otherwise keep the old extraction.
for spec in "${INSTALL[@]}"; do
  case "$spec" in
    *airgen-ui.tgz) rm -rf node_modules/@airgen/ui ;;
    *airgen.tgz) rm -rf node_modules/airgen ;;
  esac
done
npm install --no-audit --no-fund "${INSTALL[@]}"

if [ "$WATCH" = 1 ]; then
  echo
  exec node "$ROOT/scripts/sandbox-watch.mjs" "$TARGET"
fi

echo
echo "==> sandbox updated — restart \`block run\` if it was running"
