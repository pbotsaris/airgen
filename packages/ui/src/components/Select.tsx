import * as React from 'react';
import {Caret} from './Caret.js';
import {Divide} from './Divide.js';
import {PillOption} from './PillOption.js';
import {Portal} from './Portal.js';
import {airtableColorToHex} from '../colors.js';
import {controlSizeClasses, multilineSizeClasses, type ComponentSize} from '../sizes.js';
import {cx, useStableId} from '../utils.js';
import {useDropdownState, useOutsideDismiss} from '../dropdown.js';
import {useAnchoredPosition} from '../positioning.js';
import {
  buildOptionEntries,
  createOptionFuse,
  entryOptions,
  filterOptions,
  indexByValue,
  nextEnabledIndex,
  normalizeOptionText,
  truncateOptions,
  type OptionItemEntry,
} from '../optionList.js';
import type {SelectOption, SelectGroup} from '../types.js';

export interface SelectOptionState {
  selected: boolean;
  active: boolean;
  disabled: boolean;
}

export interface SelectTriggerArgs {
  ref: React.Ref<HTMLButtonElement>;
  /** Forwarded `id` prop (pair with a Label htmlFor). */
  id?: string;
  open: boolean;
  toggle: () => void;
  disabled: boolean;
  selected: SelectOption | undefined;
}

interface SelectBaseProps {
  options: SelectOption[];
  placeholder?: React.ReactNode;
  /** Forwarded to the trigger (pair with a Label htmlFor). */
  id?: string;
  /** Render the selected value and options as colored PillOptions (Airtable select style). */
  pill?: boolean;
  /** Shared control size (default "base"). Matches Button/Input heights. */
  size?: ComponentSize;
  disabled?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /**
   * Fully owns an option row's visuals (e.g. a card); Select keeps keyboard
   * nav, typeahead and selection.
   */
  renderOption?: (opt: SelectOption, state: SelectOptionState) => React.ReactNode;
  /**
   * Replaces the default trigger entirely. Forward `ref` — positioning and
   * outside-click depend on it. Usually paired with matchTriggerWidth={false}.
   */
  renderTrigger?: (args: SelectTriggerArgs) => React.ReactNode;
  /** Menu width equals trigger width (default true). */
  matchTriggerWidth?: boolean;
  /** Lower bound (px) for the menu when matchTriggerWidth is false. */
  minMenuWidth?: number;
  /** Horizontal menu alignment relative to the trigger (default "start"). */
  align?: 'start' | 'end';
  /**
   * Sticky fuzzy-search input at the top of the menu; focus lives in the
   * input while open (typeahead disabled, arrows/Enter handled there).
   */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Max options rendered while the search query is empty (default unlimited). */
  maxItems?: number;
  /** Rendered when there is nothing to show (default "No results"). */
  emptyMessage?: React.ReactNode;
  /** Header label/color for `opt.group` keys. */
  groups?: SelectGroup[];
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  optionClassName?: string;
}

export interface SingleSelectProps extends SelectBaseProps {
  multiple?: false;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Custom trigger content for the selected option. */
  renderValue?: (opt: SelectOption) => React.ReactNode;
}

export interface MultiSelectProps extends SelectBaseProps {
  multiple: true;
  value?: string[];
  defaultValue?: string[];
  onChange?: (value: string[]) => void;
  /** Custom trigger content for the selected options. */
  renderValue?: (opts: SelectOption[]) => React.ReactNode;
}

export type SelectProps = SingleSelectProps | MultiSelectProps;

function useTypeahead({enabled, onMatch}: {enabled: boolean; onMatch: (query: string) => void}) {
  const buf = React.useRef('');
  const timer = React.useRef<number | null>(null);

  const clear = React.useCallback(() => {
    buf.current = '';
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  React.useEffect(() => () => clear(), [clear]);

  const onKey = React.useCallback(
    (key: string) => {
      if (!enabled) return;

      buf.current = (buf.current + key).slice(0, 64);

      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(clear, 700);

      const q = buf.current.toLowerCase();
      const repeated = q.length > 1 && [...q].every(c => c === q[0]);
      onMatch(repeated ? q[0] : q);
    },
    [clear, enabled, onMatch],
  );

  const hasBuffer = React.useCallback(() => buf.current.length > 0, []);

  return {onKey, clear, hasBuffer};
}

/**
 * Dropdown select with a portalled listbox menu.
 *
 * Handles keyboard navigation (arrows / Home / End / Enter / Escape), typeahead
 * (matches `textValue`, then string `label`, then `value`), outside-click close,
 * repositioning on scroll/resize, and open/close animation. Works controlled
 * (`value` + `onChange`) or uncontrolled (`defaultValue`). Option rows render as
 * plain labels (with optional color dot or avatar), as colored pills (`pill`),
 * or through a fully custom renderer (`renderOption`).
 *
 * With `searchable`, a sticky search input replaces typeahead: focus stays in
 * the input, options fuzzy-filter as you type, and arrows/Enter navigate the
 * filtered list. Options carrying a `group` key render under headers (colors
 * via the `groups` prop) without affecting keyboard order.
 *
 * With `multiple`, `value`/`onChange` use `string[]`: the trigger renders the
 * selection as removable pills, choosing an option toggles it without closing
 * the menu, and Backspace (in the trigger, or in an empty search input)
 * removes the last pill. The search query is kept after a toggle so several
 * matches of one query can be picked in a row.
 */
export function Select(props: SelectProps) {
  const {
    options,
    id,
    placeholder = 'Select…',
    size = 'base',
    disabled = false,
    defaultOpen = false,
    onOpenChange,
    pill = false,
    renderOption,
    renderTrigger,
    matchTriggerWidth = true,
    minMenuWidth,
    align = 'start',
    searchable = false,
    searchPlaceholder = 'Search…',
    maxItems,
    emptyMessage = 'No results',
    groups,
    className,
    triggerClassName,
    menuClassName,
    optionClassName,
  } = props;

  const multiple = props.multiple === true;

  // Selection state is normalized to string[] internally; single mode
  // reads/writes values[0]. Controlled/uncontrolled follows the value prop.
  const [internalValues, setInternalValues] = React.useState<string[]>(() => {
    if (props.multiple) return props.defaultValue ?? [];
    return props.defaultValue !== undefined ? [props.defaultValue] : [];
  });
  const controlled = props.value !== undefined;
  const values = React.useMemo<string[]>(() => {
    if (!controlled) return internalValues;
    if (props.multiple) return props.value as string[];
    return props.value !== undefined ? [props.value as string] : [];
  }, [controlled, internalValues, props.multiple, props.value]);

  const setValues = React.useCallback(
    (next: string[]) => {
      if (!controlled) setInternalValues(next);
      if (props.multiple) props.onChange?.(next);
      else if (next.length > 0) (props.onChange as ((v: string) => void) | undefined)?.(next[0]);
    },
    [controlled, props.multiple, props.onChange],
  );

  const current = multiple ? undefined : values[0];

  const [query, setQuery] = React.useState('');
  const [activeIndex, setActiveIndex] = React.useState(() => {
    const sel = indexByValue(options, current);
    return sel !== -1 ? sel : nextEnabledIndex(options, 0, 1);
  });

  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const multiTriggerRef = triggerRef as unknown as React.RefObject<HTMLDivElement | null>;
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listboxId = useStableId('select');
  // The listbox takes its accessible name from the trigger (which shows the
  // current selection and inherits any <Label htmlFor> association).
  const triggerId = id ?? `${listboxId}-trigger`;

  // filtered → grouped entries → the display-ordered list keyboard nav indexes into
  const fuse = React.useMemo(() => (searchable ? createOptionFuse(options) : null), [searchable, options]);
  const filtered = React.useMemo(() => {
    if (!searchable) return options;
    return truncateOptions(filterOptions(options, query, fuse ?? undefined), query, maxItems);
  }, [searchable, options, query, maxItems, fuse]);

  const entries = React.useMemo(() => buildOptionEntries(filtered, groups), [filtered, groups]);
  const navOptions = React.useMemo(() => entryOptions(entries), [entries]);

  const selected = React.useMemo(() => options.find(o => o.value === current), [options, current]);
  const selectedOptions = React.useMemo(
    () => values.map(v => options.find(o => o.value === v)).filter((o): o is SelectOption => o !== undefined),
    [values, options],
  );

  // keep the active option in sync with selection/options
  React.useEffect(() => {
    if (searchable) return; // searchable mode: driven by the query below
    const sel = indexByValue(navOptions, current);
    if (sel !== -1) setActiveIndex(sel);
    else setActiveIndex(prev => nextEnabledIndex(navOptions, prev, 1));
  }, [searchable, navOptions, current]);

  // searchable mode: clamp when the filtered list shrinks
  React.useEffect(() => {
    if (!searchable) return;
    setActiveIndex(prev => (navOptions.length === 0 ? -1 : Math.min(prev, navOptions.length - 1)));
  }, [searchable, navOptions.length]);

  const focusActive = React.useCallback((idx: number) => {
    const el = menuRef.current?.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    el?.focus?.({preventScroll: true});
    el?.scrollIntoView?.({block: 'nearest'});
  }, []);

  const scrollToItem = (idx: number) => {
    requestAnimationFrame(() => {
      const el = menuRef.current?.querySelector(`[data-idx="${idx}"]`);
      el?.scrollIntoView?.({block: 'nearest'});
    });
  };

  const {open, openMenu, close, toggle, present, animateIn} = useDropdownState({
    disabled,
    defaultOpen,
    onOpenChange,
    onOpen: () => {
      update();
      if (searchable) {
        setActiveIndex(nextEnabledIndex(navOptions, 0, 1));
        requestAnimationFrame(() => inputRef.current?.focus());
      } else {
        const sel = indexByValue(navOptions, current);
        const next = sel !== -1 ? sel : nextEnabledIndex(navOptions, 0, 1);
        setActiveIndex(next);
        queueMicrotask(() => focusActive(next));
      }
    },
    onClose: () => {
      if (searchable) setQuery('');
    },
  });

  const {style: menuPosStyle, anchorWidth, update} = useAnchoredPosition({
    open,
    anchorRef: triggerRef,
    align,
    matchAnchorWidth: matchTriggerWidth,
  });

  useOutsideDismiss({enabled: open, refs: [triggerRef, menuRef], onDismiss: close});

  const commitIndex = React.useCallback(
    (idx: number) => {
      const opt = navOptions[idx];
      if (!opt || opt.disabled) return;
      if (multiple) {
        // toggle membership, stay open, keep focus where it is
        const has = values.includes(opt.value);
        setValues(has ? values.filter(v => v !== opt.value) : [...values, opt.value]);
        return;
      }
      setValues([opt.value]);
      close();
      triggerRef.current?.focus({preventScroll: true});
    },
    [navOptions, multiple, values, setValues, close],
  );

  const removeValue = React.useCallback(
    (value: string) => {
      setValues(values.filter(v => v !== value));
    },
    [values, setValues],
  );

  const removeLast = React.useCallback(() => {
    if (values.length > 0) setValues(values.slice(0, -1));
  }, [values, setValues]);

  const typeahead = useTypeahead({
    enabled: open && !searchable,
    onMatch: q => {
      const idx = navOptions.findIndex(o => !o.disabled && normalizeOptionText(o).toLowerCase().startsWith(q));
      if (idx !== -1) {
        setActiveIndex(idx);
        focusActive(idx);
      }
    },
  });

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (multiple && e.key === 'Backspace' && !open) {
      e.preventDefault();
      removeLast();
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu();
      return;
    }
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const isModifier = e.ctrlKey || e.altKey || e.metaKey;

    // Space selects (ARIA listbox pattern) unless a typeahead word is in
    // flight, in which case it extends the buffer ("new york").
    if (!isModifier && e.key.length === 1 && !(e.key === ' ' && !typeahead.hasBuffer())) {
      typeahead.onKey(e.key);
      if (e.key === ' ') e.preventDefault();
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      triggerRef.current?.focus({preventScroll: true});
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      return;
    }

    if (multiple && e.key === 'Backspace') {
      e.preventDefault();
      removeLast();
      return;
    }

    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commitIndex(activeIndex);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir = e.key === 'ArrowDown' ? 1 : -1;
      const next = nextEnabledIndex(navOptions, activeIndex + dir, dir);
      if (next !== -1) {
        setActiveIndex(next);
        focusActive(next);
      }
      return;
    }

    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      const start = e.key === 'Home' ? 0 : navOptions.length - 1;
      const dir = e.key === 'Home' ? 1 : -1;
      const next = nextEnabledIndex(navOptions, start, dir);
      if (next !== -1) {
        setActiveIndex(next);
        focusActive(next);
      }
    }
  };

  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      triggerRef.current?.focus({preventScroll: true});
      return;
    }

    if (multiple && e.key === 'Backspace' && query === '') {
      e.preventDefault();
      removeLast();
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const dir: 1 | -1 = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex(prev => {
        const next = nextEnabledIndex(navOptions, prev + dir, dir);
        if (next === -1) return prev;
        scrollToItem(next);
        return next;
      });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      commitIndex(activeIndex);
      return;
    }
  };

  const activeOption = navOptions[activeIndex];

  const renderOptionRow = (entry: OptionItemEntry) => {
    const {opt, index} = entry;
    const isSelected = multiple ? values.includes(opt.value) : opt.value === current;
    const isActive = index === activeIndex;
    const isDisabled = !!opt.disabled;

    return (
      <div
        key={opt.value}
        id={`${listboxId}-opt-${opt.value}`}
        role="option"
        aria-selected={isSelected}
        aria-disabled={isDisabled || undefined}
        tabIndex={searchable || isDisabled ? -1 : isActive ? 0 : -1}
        data-idx={index}
        onMouseMove={() => !isDisabled && setActiveIndex(index)}
        onClick={() => !isDisabled && commitIndex(index)}
        className={cx(
          renderOption
            ? 'rounded mb-1 last:mb-0'
            : cx(
                'flex items-center justify-between gap-2 rounded',
                multilineSizeClasses(size),
                'dark:text-neutral-100',
                isActive && 'bg-neutral-100 dark:bg-neutral-700',
              ),
          'outline-none select-none',
          isDisabled && 'opacity-50 cursor-not-allowed',
          !isDisabled && 'cursor-pointer',
          optionClassName,
        )}
      >
        {renderOption ? (
          renderOption(opt, {selected: isSelected, active: isActive, disabled: isDisabled})
        ) : (
          <>
            <span className="min-w-0 flex-1">
              {pill ? (
                <PillOption opt={opt} show size={size} className="max-w-full" />
              ) : (
                <span className="flex items-center gap-2 min-w-0">
                  {opt.profilePicUrl ? (
                    <img src={opt.profilePicUrl} alt="" className="h-5 w-5 rounded-full ring-1 ring-black/10 dark:ring-white/10" />
                  ) : opt.color ? (
                    <span
                      className="h-1.5 w-1.5 rounded-full ring-1 ring-black/10 dark:ring-white/10"
                      style={{
                        background: airtableColorToHex(opt.color) ?? undefined,
                      }}
                    />
                  ) : null}

                  <span className="truncate">{opt.label}</span>
                </span>
              )}
            </span>

            {isSelected ? <span className="text-neutral-600 dark:text-neutral-300">✓</span> : null}
          </>
        )}
      </div>
    );
  };

  const optionRows =
    entries.length === 0 ? (
      <div className="px-2 py-3 text-base text-neutral-400 dark:text-neutral-500 text-center">{emptyMessage}</div>
    ) : (
      entries.map((entry, idx) => {
        if (entry.type === 'divider') return <Divide key={`div-${idx}`} className="my-1" />;

        if (entry.type === 'header') {
          return (
            <div
              key={`hdr-${idx}`}
              className="flex items-center gap-2 px-2 py-1.5 text-sm font-semibold text-neutral-500 dark:text-neutral-400 select-none"
            >
              {entry.color && (
                <span
                  className="h-2 w-2 rounded-full ring-1 ring-black/10 dark:ring-white/10 flex-none"
                  style={{background: airtableColorToHex(entry.color) ?? undefined}}
                />
              )}
              <span className="truncate">{entry.label}</span>
            </div>
          );
        }

        return renderOptionRow(entry);
      })
    );

  const triggerClasses = cx(
    'w-full min-w-[10rem] inline-flex items-center justify-between gap-2',
    controlSizeClasses(size),
    'rounded-md border border-neutral-200 bg-white',
    'dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100',
    'hover:bg-neutral-50 dark:hover:bg-neutral-700',
    'focus:outline-none focus:ring-1 focus:ring-neutral-300 dark:focus:ring-neutral-500',
    disabled && 'opacity-60 cursor-not-allowed',
    triggerClassName,
  );

  const defaultTrigger = multiple ? (
    // A div, not a button: the pills carry real remove buttons and nested
    // interactive controls inside a button are invalid HTML.
    <div
      id={triggerId}
      // cast: @types/react@17 wants a non-nullable RefObject in ref position
      ref={multiTriggerRef as React.RefObject<HTMLDivElement>}
      role="combobox"
      tabIndex={disabled ? -1 : 0}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      // A div combobox is not name-from-content, so it takes its accessible
      // name from its own value span (the pills, or the placeholder).
      aria-labelledby={`${listboxId}-value`}
      aria-disabled={disabled || undefined}
      onClick={() => !disabled && toggle()}
      onKeyDown={onTriggerKeyDown}
      className={cx(triggerClasses, 'h-auto min-h-8 flex-wrap justify-start')}
    >
      <span id={`${listboxId}-value`} className={cx('min-w-0 flex-1 flex flex-wrap items-center gap-1')}>
        {selectedOptions.length > 0 ? (
          (props as MultiSelectProps).renderValue ? (
            (props as MultiSelectProps).renderValue!(selectedOptions)
          ) : (
            selectedOptions.map(opt => (
              <span key={opt.value} className="inline-flex items-center gap-0.5 min-w-0">
                <PillOption opt={opt} size={size} className="max-w-full" />
                {!disabled && (
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={`Remove ${normalizeOptionText(opt)}`}
                    onClick={e => {
                      e.stopPropagation();
                      removeValue(opt.value);
                    }}
                    className="flex-none rounded-full px-0.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    ×
                  </button>
                )}
              </span>
            ))
          )
        ) : (
          <span className="text-neutral-500 dark:text-neutral-400">{placeholder}</span>
        )}
      </span>

      <Caret open={open} weight={2.5} className="ml-auto flex-none" />
    </div>
  ) : (
    <button
      id={triggerId}
      ref={triggerRef}
      type="button"
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      onClick={toggle}
      onKeyDown={onTriggerKeyDown}
      className={cx(triggerClasses, 'disabled:opacity-60 disabled:cursor-not-allowed')}
    >
      <span className={cx('min-w-0 flex-1', pill && 'flex justify-start')}>
        {selected ? (
          (props as SingleSelectProps).renderValue ? (
            (props as SingleSelectProps).renderValue!(selected)
          ) : pill ? (
            <div className="ml-1">
              <PillOption opt={selected} size={size} className="max-w-full w-fit" />
            </div>
          ) : (
            <span className="truncate">{selected.label}</span>
          )
        ) : (
          <span className="text-neutral-500 dark:text-neutral-400">{placeholder}</span>
        )}
      </span>

      <Caret open={open} weight={2.5} />
    </button>
  );

  return (
    <div className={cx('inline-block', className)}>
      {renderTrigger ? renderTrigger({ref: triggerRef, id, open, toggle, disabled, selected}) : defaultTrigger}

      {present && (
        <Portal>
          <div
            // cast: @types/react@17 wants a non-nullable RefObject in ref position
            ref={menuRef as React.RefObject<HTMLDivElement>}
            // In searchable mode the listbox role lives on the inner list so
            // the combobox input isn't a child of the listbox (invalid ARIA).
            {...(searchable
              ? {}
              : {
                  id: listboxId,
                  role: 'listbox',
                  'aria-labelledby': triggerId,
                  'aria-multiselectable': multiple || undefined,
                })}
            tabIndex={-1}
            onKeyDown={searchable ? undefined : onMenuKeyDown}
            className={cx(
              'fixed z-popover rounded border border-neutral-200 bg-white shadow-sm',
              'dark:border-neutral-600 dark:bg-neutral-800',
              searchable ? 'flex flex-col max-h-72' : 'p-1 max-h-72 overflow-auto',
              'transition-[opacity,transform] duration-100 ease-out',
              animateIn ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-[0.95] pointer-events-none',
              menuClassName,
            )}
            style={{
              ...menuPosStyle,
              ...(matchTriggerWidth ? {} : {minWidth: minMenuWidth ? Math.max(anchorWidth, minMenuWidth) : anchorWidth}),
            }}
          >
            {searchable ? (
              <>
                {/* Sticky search input */}
                <div className="flex-none border-b border-neutral-200 dark:border-neutral-600 p-1.5">
                  <input
                    ref={inputRef}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listboxId}
                    aria-autocomplete="list"
                    value={query}
                    onChange={e => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    onKeyDown={onSearchKeyDown}
                    placeholder={searchPlaceholder}
                    className={cx(
                      'w-full px-2 py-1.5 text-base outline-none rounded',
                      'bg-transparent dark:text-neutral-100',
                      'placeholder:text-neutral-400 dark:placeholder:text-neutral-500',
                    )}
                    aria-activedescendant={activeOption ? `${listboxId}-opt-${activeOption.value}` : undefined}
                  />
                </div>

                {/* Scrollable list */}
                <div
                  id={listboxId}
                  role="listbox"
                  aria-labelledby={triggerId}
                  aria-multiselectable={multiple || undefined}
                  className="flex-1 overflow-auto p-1.5"
                >
                  {optionRows}
                </div>
              </>
            ) : (
              optionRows
            )}
          </div>
        </Portal>
      )}
    </div>
  );
}
