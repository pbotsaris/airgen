# Changelog

All notable changes to `@airgen/ui` are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
The package is private and unpublished until `0.1.0`.

## [Unreleased] — 0.1.0-dev

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
