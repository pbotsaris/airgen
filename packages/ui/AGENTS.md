# Repository Guidelines

## Project Structure & Module Organization

This workspace contains the `@airgen/ui` React component package. Public components live in `src/components/`, context APIs in `src/providers/`, and shared helpers and types directly under `src/`. Export every supported public API from `src/index.ts`. Styles originate in `src/styles.css`; Tailwind configuration is in `tailwind.config.cjs`, and compiled output is written to `dist/`. Every utility class in `src/` is written with the `ag-` prefix the config sets (`dark:ag-text-gray-100`, `-ag-rotate-90`); an unprefixed one silently gets no CSS, and `test/prefix.test.tsx` fails on it. Tests live in `test/` and mirror features rather than source folders (for example, `test/select.test.tsx`). Maintenance scripts belong in `scripts/`.

## Build, Test, and Development Commands

Run commands from this directory unless noted otherwise:

- `npm test` runs the Vitest suite once in jsdom.
- `npm run build` type-checks and emits JavaScript/declarations, then builds minified CSS into `dist/`.
- `npm run check:react17` validates the package against its minimum supported React type version.
- `npm run gen:colors` regenerates the vendored Airtable color table.
- `npm run format` or `npm run format:check`, run from the repository root, applies or verifies Prettier formatting.

Before submitting, run `npm test && npm run build && npm run check:react17`.

## Coding Style & Naming Conventions

Use strict TypeScript, React function components, and ESM imports. Follow the repository Prettier settings: two-space indentation, single quotes, semicolons, 120-column width, no bracket spacing, and trailing commas. Component and provider files use PascalCase (`ToastProvider.tsx`); utilities use camelCase (`optionList.ts`). Keep browser behavior accessible, preserve forwarded refs, and use `.js` extensions in imports emitted from `src/`. The root ESLint configuration intentionally excludes this package, so TypeScript, Prettier, and tests are the primary checks.

## Testing Guidelines

Write `*.test.ts` or `*.test.tsx` files under `test/`. Use Vitest with Testing Library and `user-event`; prefer role/name queries and observable behavior over implementation details. Add regression tests for bug fixes and accessibility checks for interactive components. `test/setup.ts` provides shared DOM matchers, and `test/no-sdk.test.ts` guards the package from importing `@airtable/blocks`.

## Commit & Pull Request Guidelines

Recent commits use short, descriptive subjects such as `added providers` and `fuseMatcher for @airgen/ui`; keep subjects focused and mention this package when useful. Pull requests should explain the user-visible change, list verification commands, link related issues, and include screenshots or recordings for visual or interaction changes. Update `CHANGELOG.md` for noteworthy public API or behavior changes.
