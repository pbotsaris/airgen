# @airgen/ui

Airtable-native React components for Airtable extensions, built to pair with
[airgen](../../README.md)'s generated schema metadata.

> **Status: pre-release (0.x).** The SDK-bound half (flavor entries,
> `RecordSelect`, typed field controls) is still being built, and the API may
> change between minor versions until 1.0.

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
- **Tables** — semantic table primitives plus `RecordTable`, a typed renderer
  for the `{id, fields, raw}` rows returned by airgen's `useRecords`.
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

Render an airgen record collection directly; `RecordTable` infers populated
fields when `columns` is omitted. Pass typed field keys to limit or reorder the
visible columns. Common Airtable values such as select choices, linked records,
lookups, and arrays receive useful defaults; use a full column definition for
custom output.

```tsx
import {RecordTable, type RecordTableColumn} from '@airgen/ui';
import {useRecords, type TableRecordMap} from './airtable-schema';
import type {TypedRecord} from 'airgen';

type Project = TypedRecord<TableRecordMap, 'Projects'>;

export function ProjectsTable() {
  const projects = useRecords('Projects');

  // `columns` is optional. These keys autocomplete from Project.fields.
  return <RecordTable records={projects} columns={['name', 'status', 'owner']} />;
}
```

For derived or action columns, provide an accessor and optional custom cell:

```tsx
const columns: RecordTableColumn<Project>[] = [
  {id: 'name', header: 'Project'},
  {
    id: 'actions',
    header: '',
    accessor: record => record.id,
    cell: ({record}) => <button>Edit {record.fields.name}</button>,
  },
];
```

Because generated fields are optional and empty cells are omitted, automatic
inference can only discover field keys populated in the current records. Pass
`columns` when an empty field must remain visible.

`color` on options and `Button` accepts an Airtable color name
(`"blueBright"`) or any CSS hex. The CSS ships precompiled with the
package's own tokens; your project needs no Tailwind config (and if it has
one, it never scans this package).

Every utility in that stylesheet is prefixed `ag-` (`ag-text-neutral-900`,
`dark:ag-text-gray-100`), so your own Tailwind can use the same palette
without overriding the components: an unprefixed `text-neutral-900` from your
build never matches their elements. The classes you pass (`className`,
`optionClassName`, `rowClassName`, …) are yours and stay unprefixed; only
`pillSizeClasses()` hands back the package's own (prefixed) classes.

Dark variants follow the frame's `prefers-color-scheme`, which is the same
signal the SDK's `useColorScheme` reads (both SDK flavors implement the hook as
that media query), so the components already match whatever the hook reports
and need no setup. Wrap the app in `ThemeProvider` only to force a scheme,
for a theme toggle say; menus, dialogs and toasts portalled to `document.body`
follow it too:

```tsx
import {ThemeProvider} from '@airgen/ui';

function Root() {
  const [scheme, setScheme] = useState<'light' | 'dark' | 'system'>('system');
  return (
    <ThemeProvider colorScheme={scheme}>
      <App onScheme={setScheme} />
    </ThemeProvider>
  );
}
```

`colorScheme="system"`, like no provider, keeps the media-query behavior. Your own
Tailwind `dark:` classes follow the override only if your config uses the same
variant as the package:

```js
darkMode: [
  'variant',
  [
    '@media (prefers-color-scheme: dark) { &:not(:where([data-ag-theme="light"] *)) }',
    '&:where([data-ag-theme="dark"] *)',
  ],
],
```

The components paint their own surfaces where they float (menus, popovers,
dialogs, tables) but not the page background; that stays with your extension
(the scaffold's `bg-gray-gray50 dark:bg-gray-gray800`).

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
