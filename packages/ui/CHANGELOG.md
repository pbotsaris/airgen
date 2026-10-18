# Changelog

All notable changes to `@airgen/ui` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Pre-1.0, minor versions may contain breaking changes.

## [Unreleased]

## [0.2.0] — 2026-10-18

### Added

- **`NestedRecordTable`** — renders rows hydrated with `useRecords(key,
  {include})`: each row expands into one sub-table per included link,
  recursively, with per-level columns. `nested` keys are typed from the
  hydrated record, so un-included links are rejected at compile time.
- **`GroupTable`** — renders `groupRecords` output with one collapsible
  group row per value and nested levels for multi-field grouping. A `summary`
  callback supplies per-column aggregations, placed in the group row or in a
  totals row via `summaryPlacement`.
- **`InlineEdit`** — click-to-edit value that commits on Enter or blur and
  cancels on Escape. `format`/`toInputValue`/`parse` separate display from
  editing (e.g. currency shown with `Intl.NumberFormat`, edited as a bare
  number); a `parse` that throws or an `onCommit` that rejects keeps the draft
  open and shows the error. `renderEditor` swaps in any control (a `Select`,
  say) through `InlineEditEditorContext`.
- **Expandable rows on `RecordTable`** — `renderExpanded` adds a leading
  toggle column and a full-width row under each expanded record; `canExpand`,
  `defaultExpanded`, and controlled `expanded`/`onExpandedChange`
  (`RecordTableExpandedMap`, keyed by row key) control which rows open.
- **Column resizing** — opt-in on `Table` and `RecordTable` with `resizable`.
  Drag header handles or use arrow keys (Shift for larger steps), Home, and
  End. Columns support `minWidth`, `maxWidth`, `resizeLabel`, and individual
  `resizable={false}` opt-outs; a `TableHead` with `scope="rowgroup"` never
  gets a handle. `TableHeadProps` is now exported.
- Optional `columnLines` on `Table` and `RecordTable` for vertical dividers
  between columns, with light and dark theme colors.
- **Examples ship with the package** — `examples/` holds one small,
  typechecked usage file per component (`npm run check:examples`), and every
  public component, prop, and default now carries JSDoc with an `@example`,
  so editors show usage on hover.

### Changed

- The README is rewritten around the examples: a shorter quick start plus a
  component index pointing at each example file.

## [0.1.0] — 2026-10-18

### Added

- **`ThemeProvider`** — `<ThemeProvider colorScheme="dark">` forces the
  components' dark variants on or off, portals included (for a theme toggle).
  Without it they follow the frame's `prefers-color-scheme`, which is exactly
  what the SDK's `useColorScheme` reports, so following Airtable needs no
  setup. `"system"`, or no provider, keeps the media query.
- **Table components** — semantic, shadcn-inspired `Table`, `TableHeader`,
  `TableBody`, `TableFooter`, `TableRow`, `TableHead`, `TableCell`, and
  `TableCaption` primitives, plus a generic `RecordTable` and
  `RecordCellValue` for airgen `useRecords` results. The record renderer stays
  SDK-free and handles common Airtable choices, links, lookups, arrays, empty
  cells, loading states, custom accessors, and custom cell renderers. Its
  optional `columns` prop accepts generated field keys as a typed shorthand;
  when omitted, columns are inferred from populated record fields.
- **`fuseMatcher`** — a fuse.js `SearchMatcher` for airgen's `query()`
  (`search: {query, fields, matcher: fuseMatcher}`), with the same settings as
  `Select`'s search (`threshold: 0.4`, `ignoreLocation`). Keeps fuse.js out of
  airgen's own dependencies.

### Changed

- **Utilities are prefixed `ag-`.** The precompiled stylesheet used Tailwind's
  unprefixed names, so a consumer's own Tailwind emitting the same class
  (`text-neutral-900`, say) won on load order and overrode the components'
  `dark:` variants (black title text on a dark frame, a light `RecordTable`
  header). Every utility is now `ag-` prefixed and can't share a selector with
  the consumer's. Consumer-passed classes are unaffected; `pillSizeClasses()`
  now returns prefixed classes, which `@airgen/ui/styles.css` defines.

### Fixed

- **`Button` variants in dark mode.** `outline` painted a white background
  with the page's light text, `secondary` stayed light gray, and `ghost`
  hovered to near-white, so `ButtonToggle`, icon-only buttons and the usual
  Popover/Sheet triggers were unreadable on a dark frame. All three now carry
  dark variants matching the `Select` trigger.
- **Neutral pills in dark mode.** A pill with no color of its own (linked
  records in `RecordCellValue`, colorless choices, avatars) was an inline
  `#eeeeee`, so it stayed light gray on a dark frame. It's now classes, with
  Airtable's own dark linked-record pill (`rgba(195,212,249,0.18)`, white
  text) under `dark:`. `PillOption`'s `bg`/`useLightText` overrides still win.
- **`Badge` wrapped in narrow cells.** It was an `inline-block` div, so a long
  name in a table cell wrapped into a two-line blob with the text pushed to one
  side. It's now a single-line, truncating `span` (full name in `title`).

## [0.1.0-dev.1] — 2026-08-03

### Added (Phase 2 — selection stack, overlays, providers, 2026-08-03)

- **`Select`, single and multi.** Portalled listbox with keyboard navigation
  (arrows/Home/End with disabled-skip and wrap-around, Enter/Space select,
  Escape, 700 ms typeahead with repeated-char handling), outside-click
  dismissal, open/close animation, optional fuzzy search (`searchable`, backed
  by fuse.js with a reused index), grouped options with colored headers,
  Airtable-colored pills (`pill`), and `renderOption`/`renderValue`/
  `renderTrigger` escape hatches. `multiple` switches `value`/`onChange` to
  `string[]`: the trigger renders removable pills in selection order, choosing
  an option toggles it without closing the menu, Backspace removes the last
  pill (from the trigger, or from an empty search query), and the search query
  survives toggles so several matches can be picked in a row.
- **`PillOption`** — Airtable-colored option pill (color name or hex via the
  vendored palette, avatar support, auto light/dark text).
- **`Popover`** (`Popover.Trigger/Content/Close`, also named exports) with
  side/align/offset positioning, viewport clamping, opt-in `flip`, real exit
  animations, optional focus trap, and preventable
  `onEscapeKeyDown`/`onInteractOutside`.
- **`Tooltip`** (`TooltipTrigger`/`TooltipContent`) with hover delay,
  focus/blur triggering, Escape close, controlled `open`, and an `asChild`
  trigger — now properly announced via `aria-describedby`.
- **`Dialog` and `Sheet`** compound components: focus trap and restore,
  `initialFocusRef`, body scroll lock, overlay click, exit animations, and
  `asChild` trigger/close. `aria-labelledby`/`aria-describedby` are emitted
  only when `Title`/`Description` actually render, and Escape closes only the
  focused dialog when dialogs nest.
- **`ToastProvider` + `useToast`** — `toast/error/warning/info` (returning
  ids), `dismiss(id)`, `clear()`, per-key delay debouncing, a `maxToasts` cap,
  and viewport `position`/`container` props. The toast viewport is a
  persistent `aria-live` region (announcements actually fire) and error toasts
  use `role="alert"`.
- **`SheetProvider` + `useSheet`** — imperative
  `openSheet({content, title?, side?, className?, data?, renderHeader?})` /
  `closeSheet()`; the header row is omitted without a title, and content
  unmounts after the exit animation instead of staying mounted behind a closed
  sheet.
- **One positioning engine.** A single internal `useAnchoredPosition` hook
  drives Select, Popover, and Tooltip (the sources carried three copies).
  `align="end"` menus now sit flush against the trigger even with a visible
  scrollbar, and content that changes size while open repositions via
  ResizeObserver.
- **Unified z-index scale** as Tailwind tokens: `z-overlay` (50) <
  `z-popover` (60) < `z-toast` (70) < `z-tooltip` (80) — a Select inside a
  Dialog renders above the overlay by construction.
- `pillSizeClasses` joins the exported size helpers; `fuse.js` becomes the
  package's second (and last) runtime dependency.

### Added (Phase 1 — foundation, 2026-08-03)

- Initial buildable package: strict-TS NodeNext ESM with declarations and
  package-compiled Tailwind CSS on the interface-alpha `block init` theme
  scale (13 px base, control-x/y spacing tokens, preflight off,
  `darkMode: 'media'`).
- Primitives ported from the in-house app sources: `Badge`, `Button`,
  `ButtonToggle`, `Caret`, `CaretButton`, `Circle`, `Divide`, `Icon`, `Input`,
  `Label`, `Portal`, `Spinner`/`LoadingOverlay`, `Text`, `Toggle` — with the
  audited fixes (Badge's inverted null-throwing guard, Text `forwardRef`,
  Button de-SDKed color prop, Spinner `aria-label`).
- **Vendored Airtable palette** (`airtableColorToHex`, `shouldUseLightText`,
  `isHexColor`): 50 colors extracted from `@airtable/blocks`, so components
  speak Airtable color names with zero SDK imports (pinned by a no-SDK dist
  test).
- React support: runtime React 19, with a React 17 compatibility floor
  enforced by a types-only `check:react17` compile leg.

### Internal

- Suite grew from 30 to 133 Vitest + Testing Library tests, including
  keyboard-interaction coverage for every interactive component, an axe pass
  over open Select/Popover/Tooltip/Dialog (with and without `Title`)/Sheet/
  toast stack, and a packed-tarball SSR consumer check (portalled content
  stays out of server output). `@testing-library/jest-dom` and a
  bundler-resolution `test/tsconfig.json` back the suites.
