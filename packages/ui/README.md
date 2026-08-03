# @airgen/ui

Airtable-native React components for Airtable extensions, built to pair with
[airgen](../../README.md)'s generated schema metadata.

> **Status: pre-release.** The package is private and unpublished while the
> SDK-bound half (flavor entries, `RecordSelect`, typed field controls) is
> still being built. Try it today via `npm pack` — see below.

Components speak Airtable's language directly: select options carry Airtable
color names (resolved through a vendored palette — **no `@airtable/blocks`
import anywhere in this package**, pinned by a test), selects render
single-select-style pills, and the Tailwind theme matches the interface
extension scaffold's scale (13 px base text, same radii/shadows/control
heights), so components sit visually flush with the host SDK UI.

## What's in the box

- **Primitives** — `Button`, `Input`, `Toggle`, `Badge`, `Text`, `Label`,
  `Icon`, `Spinner`/`LoadingOverlay`, `Caret`, `CaretButton`, `ButtonToggle`,
  `Circle`, `Divide`, `Portal`.
- **Selection** — `Select` (single and `multiple`, keyboard navigation,
  typeahead, optional fuzzy search, grouped options, Airtable-colored pills,
  custom renderers) and `PillOption`.
- **Overlays** — `Popover`, `Tooltip`, `Dialog`, `Sheet` (focus trap and
  restore, scroll lock, exit animations, `asChild` triggers).
- **Feedback** — `ToastProvider`/`useToast` and `SheetProvider`/`useSheet`
  for imperative toasts and side panels.
- **Helpers** — `airtableColorToHex`, `shouldUseLightText`, size class
  helpers, `SelectOption`/`SelectGroup` types.

## Usage

```tsx
import {Button, Select, ToastProvider, useToast} from '@airgen/ui';
import '@airgen/ui/styles.css'; // precompiled — no Tailwind setup required

function Picker() {
  const {info} = useToast();
  return (
    <Select
      pill
      options={[
        {value: 'todo', label: 'Todo', color: 'yellowBright'},
        {value: 'done', label: 'Done', color: 'greenBright'},
      ]}
      onChange={value => info(`moved to ${value}`)}
    />
  );
}

export function App() {
  return (
    <ToastProvider>
      <Picker />
    </ToastProvider>
  );
}
```

`color` on options and `Button` accepts an Airtable color name
(`"blueBright"`) or any CSS hex. The CSS ships precompiled with the
package's own tokens; your project needs no Tailwind config (and if it has
one, it never scans this package).

Until the package is published, install it from a tarball:

```sh
cd packages/ui && npm run build && npm pack
# then, in your extension:
npm install /path/to/airgen-ui-<version>.tgz
```

## Requirements

- `react` / `react-dom` `>= 17` (peer dependencies). Runtime development
  targets React 19 (what interface extensions scaffold); a types-only
  compile leg keeps the code on React 17 APIs for the stable SDK.

## Development

```sh
npm test --workspace @airgen/ui             # Vitest + Testing Library suite
npm run build --workspace @airgen/ui        # tsc + Tailwind → dist/
npm run check:react17 --workspace @airgen/ui  # React 17 compatibility typecheck
```

From the repo root, `npx vitest` also picks up this package's suite. See
[`CHANGELOG.md`](CHANGELOG.md) for what's landed and
[`../../plan/AIRGEN_UI_PLAN.md`](../../plan/AIRGEN_UI_PLAN.md) for the
roadmap.
