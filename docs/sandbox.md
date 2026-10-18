# Sandbox (maintainers)

`sandbox/` is an interface extension (`@airtable/blocks@interface-alpha`) that installs the local `airgen` and `@airgen/ui`, so changes can be tried in a real extension without publishing.

## Install the local packages

```sh
scripts/sandbox.sh            # both packages
scripts/sandbox.sh airgen     # or just one
scripts/sandbox.sh ui
```

This builds and `npm pack`s each package (exactly what `npm publish` would ship), writes the tarballs to `sandbox/vendor/airgen.tgz` and `sandbox/vendor/airgen-ui.tgz`, and reinstalls them. The file names are fixed, so versions never need bumping.

## Run it

```sh
cd sandbox
npx airgen                    # daemon + block run
```

## Live reload

```sh
scripts/sandbox.sh --watch        # or --watch ui / --watch airgen
```

Runs the install above, then keeps `tsc` (and Tailwind, for ui) in watch mode and copies each rebuild into `sandbox/node_modules`. `block run` sees the change and reloads the extension. Leave it running beside `npx airgen`, and stop it with Ctrl+C.

- **Daemon changes** (`src/daemon`) are copied too, but the daemon is a running process: restart `npx airgen` to pick them up.
- **`package.json` or dependency changes** need a plain `scripts/sandbox.sh`.
- The packages are copied, not linked. A symlinked package would resolve `react` and `@airtable/blocks` from the repo root, giving the bundle two Reacts and the stable SDK.
