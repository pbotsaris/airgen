# Releasing (maintainers)

This repo is an npm workspace holding two independently versioned packages: `airgen` (the repo root) and [`@airgen/ui`](../packages/ui/README.md) (Airtable-native React components, currently pre-release). Each keeps its own `CHANGELOG.md`, and releases are tagged per package: `airgen@0.3.0`, `@airgen/ui@0.1.0` (the Changesets/Lerna convention; plain `v*` tags before `airgen@0.3.0` are historical airgen releases).

Cut a release with the helper script:

```sh
scripts/release.sh airgen patch     # or minor / major / an exact x.y.z
scripts/release.sh ui 0.1.0
```

It refuses a dirty tree or a non-`main` branch, bumps the right `package.json` (syncing the lockfile), **requires a `## [x.y.z]` section in that package's changelog** (rolling the bump back otherwise), runs the package's checks (airgen: `npm run check`; ui: build, Vitest suite, and the React 17 typecheck leg), then commits `Release <pkg>@x.y.z` and creates the tag. Pushing and publishing stay manual; the script prints the exact `git push` / `npm publish` commands to finish with.

Before an airgen release, run the manual smoke test in any interface extension on any base: one write through `useMutations`, memo stability across cell edits, several hooks with `customProperties` on one page, bundle size, and no stable-SDK import in the interface bundle.
