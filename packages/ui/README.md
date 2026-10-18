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
- **Inline editing** — `InlineEdit`, with text/number drafts, display formatting,
  async save/error handling, and a custom editor callback.
- **Overlays** — `Popover`, `Tooltip`, `Dialog`, `Sheet` (focus trap and
  restore, scroll lock, exit animations, `asChild` triggers).
- **Feedback** — `ToastProvider`/`useToast` and `SheetProvider`/`useSheet`
  for imperative toasts and side panels.
- **Tables** — semantic table primitives plus `RecordTable`, a typed renderer
  for `useRecords` rows with optional expandable rows; `NestedRecordTable`
  for rows hydrated with `include`; and `GroupTable` for `groupRecords`
  output with nested, collapsible groups and per-group summaries.
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

Enable column resizing with `<RecordTable resizable records={projects} />` or
`<Table resizable>`. Resizing supports a single header row without column or
row spans; use it without a custom `colgroup`. Drag a header's right edge, or
focus its handle and press Left/Right (10 px, or 50 px with Shift). Home sets
the minimum width; End sets the maximum when supplied. Other columns keep
their widths, and wider tables scroll horizontally.

Set `minWidth` (default 80 px), `maxWidth`, `resizable: false`, or `resizeLabel`
on individual `RecordTable` column definitions, or as props on `TableHead`.
For example, `{id: 'name', width: 240, minWidth: 120, maxWidth: 480}` starts
with the normal column width and constrains subsequent resizing. Provide
`resizeLabel` for headers containing icons or other non-text content.

Add `columnLines` to `Table` or `RecordTable` to show thin vertical dividers
between columns in the header, body, and footer. Dividers support light and
dark themes and can be used with or without `resizable`:

```tsx
<RecordTable records={projects} columns={['name', 'status', 'owner']} columnLines resizable />
```

### Expandable rows

Pass `renderExpanded` to prepend a toggle column; its output renders in a
full-width row under each expanded record. `canExpand` leaves some rows
without a toggle, `defaultExpanded` (a boolean or a predicate) sets the
initial state, and `expanded` plus `onExpandedChange` control it — a map of
row keys to booleans that overrides the default, so "everything open except
these" needs no enumeration:

```tsx
<RecordTable
  records={projects}
  columns={['name', 'status']}
  canExpand={project => (project.fields.tasks?.length ?? 0) > 0}
  renderExpanded={({record}) => <TaskList project={record} />}
/>
```

### Nested tables for `include`

`NestedRecordTable` renders rows hydrated with `useRecords(key, {include})`:
each row expands into one sub-table per included link, and those nest in
turn, each level with its own columns. The keys of `nested` are the links the
record type carries hydrated, so an un-included link (still `{id, name}[]`) or
a level deeper than `include` reached fails to compile ("object literal may
only specify known properties"). Expansion is tracked per row path
(`rec1/projects/proj1`), so collapsing a parent and reopening it restores its
children; `defaultExpanded` takes `true` or a depth.

```tsx
import {NestedRecordTable} from '@airgen/ui';

const people = useRecords('People', {include: {projects: {tasks: true}}});

<NestedRecordTable
  records={people}
  columns={['name', 'email']}
  defaultExpanded={1}
  nested={{
    projects: {
      columns: ['name', 'status'],
      nested: {tasks: {columns: ['title', 'done'], emptyMessage: 'No tasks yet'}},
    },
  }}
/>;
```

### Grouped tables for `groupRecords`

`GroupTable` takes `groupRecords` output as is. Grouping by several fields
yields nested, individually collapsible group rows, one level per field;
`groupLabels` prefixes each level's value and `emptyGroupLabel` names a `null`
one. `summary` returns per-column aggregations for every group (parents see
the distinct union of their leaves' records); `summaryPlacement` puts them in
the group row (`'header'`, visible while collapsed) or in a totals row after
the records (`'footer'`). `expanded`/`onExpandedChange` are keyed by group key
(the `key` from `groupRecords` for leaves, the JSON of the values prefix for
parents).

```tsx
import {GroupTable} from '@airgen/ui';
import {groupRecords} from 'airgen';

const groups = groupRecords(projects, {fields: ['status', 'owner']});

<GroupTable
  groups={groups}
  columns={['name', 'status', 'owner', 'hours']}
  groupLabels={['Status', 'Owner']}
  summary={records => ({hours: records.reduce((total, r) => total + (r.fields.hours ?? 0), 0)})}
  summaryPlacement="footer"
/>;
```

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

## Inline editing

`InlineEdit` keeps a local draft until Enter or blur saves it. Escape discards
the draft. `value` is controlled: update it in `onCommit` after saving. Return a
promise to keep the field pending; throwing or rejecting displays an error and
keeps the draft available for correction or retry. An unchanged parsed value
does not call `onCommit`.

```tsx
<InlineEdit label="Name" value={name} onCommit={setName} />
```

For currency, keep the value numeric and format only the display. The same input,
font, padding, border width, and alignment are used in both modes. Invisible
sizers reserve space for both the committed display and its editable text, so
entering edit mode does not resize the field. Long drafts scroll within the
input; a newly committed value can resize it. Use `style={{width: '100%'}}` to
fill a fixed container instead.

```tsx
const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

<InlineEdit
  label="Budget"
  value={budget}
  onCommit={async amount => {
    await saveBudget(amount);
    setBudget(amount);
  }}
  format={money.format}
  align="right"
/>;
```

Numeric values default to ungrouped editable text and finite-number parsing;
empty or invalid drafts show an error instead of becoming zero. For localized
input or application-specific precision rules, supply `toInputValue` and `parse`.
For example, this decimal-comma parser accepts at most two fractional digits:

```tsx
<InlineEdit
  label="Budget"
  value={budget}
  onCommit={setBudget}
  format={new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'}).format}
  toInputValue={amount => amount.toFixed(2).replace('.', ',')}
  parse={draft => {
    if (!/^-?\d+(,\d{1,2})?$/.test(draft)) {
      throw new Error('Enter an amount such as 1234,50.');
    }
    return Number(draft.replace(',', '.'));
  }}
  align="right"
/>
```

Custom editors receive a string `draft`, `setDraft`, `commit`, `cancel`,
`pending`, `error`, and `label`. Use `parse` to map the string draft into another
public value type. `renderValue` optionally customizes the display; keep its
content noninteractive because it renders inside an edit button. A custom
editor defaults to explicit saving: Enter inserts newlines, and blur leaves the
session open, including when focus moves into a portalled menu. Opt into
`commitOnEnter` or `commitOnBlur` if your editor needs those behaviors. Blur
saving treats portalled controls as outside the field.

```tsx
<InlineEdit
  label="Description"
  value={description}
  onCommit={saveDescription}
  renderEditor={({draft, setDraft, commit, cancel, pending, label}) => (
    <div>
      <textarea aria-label={label} value={draft} onChange={event => setDraft(event.target.value)} disabled={pending} />
      <Button disabled={pending} onClick={() => void commit()}>
        Save
      </Button>
      <Button disabled={pending} onClick={cancel}>
        Cancel
      </Button>
    </div>
  )}
/>
```

Custom controls own their sizing and focus behavior inside the editor; the
first focusable control receives focus on opening. Save and cancel restore
focus to the trigger. Custom key handlers can prevent the default event to
handle Enter or Escape themselves. No editor engine is required by `InlineEdit`.

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
