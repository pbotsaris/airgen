# @airgen/ui

React components for Airtable extensions. Pairs with [airgen](../../README.md).

- Pre-release (0.x). APIs may change between minor versions.
- Requires React and React DOM 17 or newer.
- No `@airtable/blocks` runtime dependency.
- Precompiled CSS. No Tailwind setup required.

## Setup

Import `@airgen/ui/styles.css` once in your app. Import components from `@airgen/ui`.
See the [minimal app](examples/App.tsx).

Until published, build and install a tarball:

```sh
# From packages/ui
npm run build && npm pack
# From your extension
npm install /path/to/airgen-ui-<version>.tgz
```

## Components and examples

Each link opens TypeScript source with imports and usage examples.

| Component                                              | Purpose                                                       |
| ------------------------------------------------------ | ------------------------------------------------------------- |
| [Button](examples/Button.tsx)                          | Actions, variants, and icons.                                 |
| [ButtonToggle](examples/ButtonToggle.tsx)              | Boolean toggles or cycling choices.                           |
| [Input](examples/Input.tsx)                            | Controlled or uncontrolled text input.                        |
| [InlineEdit](examples/InlineEdit.tsx)                  | Text, currency, async saves, and custom editors.              |
| [Label](examples/Label.tsx)                            | Visible labels for form controls.                             |
| [Select](examples/Select.tsx)                          | Single/multiple selection, search, groups, and colored pills. |
| [Toggle](examples/Toggle.tsx)                          | Labeled switches.                                             |
| [Badge](examples/Badge.tsx)                            | Colored choice labels.                                        |
| [PillOption](examples/PillOption.tsx)                  | Option labels with pill styling.                              |
| [Text](examples/Text.tsx)                              | Typography and control-aligned text.                          |
| [Icon](examples/Icon.tsx)                              | Sized Lucide icons.                                           |
| [Caret](examples/Caret.tsx)                            | Decorative direction indicators.                              |
| [CaretButton](examples/CaretButton.tsx)                | Expand/collapse buttons.                                      |
| [Circle](examples/Circle.tsx)                          | Color indicators.                                             |
| [Divide](examples/Divide.tsx)                          | Horizontal or vertical separators.                            |
| [Spinner](examples/Spinner.tsx)                        | Loading indicators.                                           |
| [LoadingOverlay](examples/LoadingOverlay.tsx)          | Delayed loading overlays.                                     |
| [Popover](examples/Popover.tsx)                        | Anchored panels.                                              |
| [Tooltip](examples/Tooltip.tsx)                        | Hover/focus descriptions.                                     |
| [Dialog](examples/Dialog.tsx)                          | Modal dialogs.                                                |
| [Sheet](examples/Sheet.tsx)                            | Side panels.                                                  |
| [Portal](examples/Portal.tsx)                          | Content mounted outside its parent.                           |
| [Table and primitives](examples/Table.tsx)             | Headers, rows, cells, footers, and resizing.                  |
| [RecordTable](examples/RecordTable.tsx)                | Typed record columns and expandable rows.                     |
| [RecordCellValue](examples/RecordCellValue.tsx)        | Airtable-aware cell rendering.                                |
| [NestedRecordTable](examples/NestedRecordTable.tsx)    | Nested tables for hydrated links.                             |
| [GroupTable](examples/GroupTable.tsx)                  | Collapsible groups and summaries.                             |
| [ToastProvider / useToast](examples/ToastProvider.tsx) | Imperative notifications.                                     |
| [SheetProvider / useSheet](examples/SheetProvider.tsx) | Imperative side panels.                                       |
| [ThemeProvider](examples/ThemeProvider.tsx)            | Light, dark, or system themes.                                |
| [Helpers](examples/helpers.ts)                         | Colors, pill sizes, and fuzzy search.                         |

Table examples use [sample records](examples/records.ts). Replace them with your
`useRecords` or `groupRecords` output.

## Styling

- Components follow the system color scheme by default.
- Use [ThemeProvider](examples/ThemeProvider.tsx) to override it, including portals.
- Package utilities use the `ag-` prefix. Consumer classes keep their own names.
- Colors accept Airtable names or CSS hex values.
- Components style their own surfaces. Your app owns the page background.
- For custom Tailwind dark styles, see the [optional config](examples/tailwind.config.cjs).

## Development

Run from this directory:

```sh
npm test
npm run build
npm run check:react17
npm run check:examples
```

- `npm run gen:colors` regenerates the Airtable palette.
- Examples are type-checked against the current source API.
- See the [changelog](CHANGELOG.md) and [roadmap](../../plan/AIRGEN_UI_PLAN.md).
