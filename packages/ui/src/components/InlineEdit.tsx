import * as React from 'react';
import {Text, type TextVariant} from './Text.js';
import {SIZE_SCALE, type ComponentSize} from '../sizes.js';
import {cx, getFocusable, useStableId} from '../utils.js';

export interface InlineEditEditorContext {
  draft: string;
  setDraft: (value: string) => void;
  /** Resolves false on validation/save failure. Errors are displayed by InlineEdit. */
  commit: () => Promise<boolean>;
  cancel: () => void;
  pending: boolean;
  error: string | null;
  /** Accessible name supplied to InlineEdit. Label custom controls with this. */
  label: string;
}

export interface InlineEditProps<T = string> {
  value: T;
  /** Called only when the parsed value changes. Reject/throw to keep the draft open. */
  onCommit: (value: T) => void | Promise<void>;
  /** Accessible field name, used for the trigger and default input. */
  label: string;
  placeholder?: string;
  disabled?: boolean;
  size?: ComponentSize;
  variant?: TextVariant;
  bold?: boolean;
  align?: 'left' | 'right';
  className?: string;
  style?: React.CSSProperties;
  /** Display formatting only, e.g. Intl.NumberFormat for currency. */
  format?: (value: T) => string;
  /** Editable text, without currency symbols/grouping by default. */
  toInputValue?: (value: T) => string;
  /** Converts the draft to the public value. Throw an Error for invalid input. */
  parse?: (draft: string) => T;
  renderValue?: (value: T) => React.ReactNode;
  renderEditor?: (context: InlineEditEditorContext) => React.ReactNode;
  /** Defaults to true for the built-in input, false for custom editors. */
  commitOnBlur?: boolean;
  /** Defaults to true for the built-in input, false for custom editors. */
  commitOnEnter?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}

function InlineEditImpl<T>(
  {
    value,
    onCommit,
    label,
    placeholder = '',
    disabled = false,
    size = 'base',
    variant,
    bold,
    align = 'left',
    className,
    style,
    format,
    toInputValue,
    parse,
    renderValue,
    renderEditor,
    commitOnBlur = !renderEditor,
    commitOnEnter = !renderEditor,
    inputMode,
  }: InlineEditProps<T>,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const raw = toInputValue ? toInputValue(value) : String(value ?? '');
  const display = format ? format(value) : String(value ?? '');
  const [editing, setEditing] = React.useState(false);
  const [draft, updateDraft] = React.useState(raw);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const editorRef = React.useRef<HTMLDivElement>(null);
  const active = React.useRef(false);
  const saving = React.useRef(false);
  const draftRef = React.useRef(raw);
  const mounted = React.useRef(false);
  const restoreFocusRef = React.useRef(false);
  const errorId = useStableId('inline-edit-error');
  const metrics = SIZE_SCALE[size];

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (!editing) return;
    if (renderEditor) {
      getFocusable(editorRef.current!)[0]?.focus();
    } else {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, !!renderEditor]);

  const setDraft = (next: string) => {
    if (saving.current || disabled) return;
    draftRef.current = next;
    updateDraft(next);
    setError(null);
  };

  const start = () => {
    if (disabled || active.current) return;
    draftRef.current = raw;
    updateDraft(raw);
    setError(null);
    active.current = true;
    setEditing(true);
  };

  const finish = (restoreFocus: boolean) => {
    active.current = false;
    setEditing(false);
    setError(null);
    if (restoreFocus) {
      // The custom trigger remounts after editing ends.
      restoreFocusRef.current = true;
    }
  };
  React.useEffect(() => {
    if (!editing && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      (triggerRef.current ?? inputRef.current)?.focus();
    }
  }, [editing]);

  const commit = async (restoreFocus = true): Promise<boolean> => {
    if (!active.current || saving.current || disabled) return false;
    saving.current = true;
    setPending(true);
    try {
      const text = draftRef.current;
      let next: T;
      if (parse) next = parse(text);
      else if (typeof value === 'number') {
        const number = Number(text);
        if (!text.trim() || !Number.isFinite(number)) throw new Error('Enter a valid number.');
        next = number as T;
      } else if (typeof value === 'string') next = text as T;
      else throw new Error('Provide a parse function for this value.');
      if (!Object.is(next, value)) await onCommit(next);
      if (mounted.current) finish(restoreFocus);
      return true;
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : 'Unable to save. Please try again.');
      return false;
    } finally {
      saving.current = false;
      if (mounted.current) setPending(false);
    }
  };

  const cancel = () => {
    if (saving.current) return;
    draftRef.current = raw;
    updateDraft(raw);
    finish(true);
  };

  const controlClass = cx(
    'ag-box-border ag-w-full ag-min-w-0 ag-rounded-md ag-border ag-border-solid ag-bg-transparent ag-outline-none ag-text-inherit',
    'focus-visible:ag-ring-2 focus-visible:ag-ring-blue-500',
    'ag-transition-[border-color,background-color] ag-duration-150',
    metrics.h,
    metrics.px,
    align === 'right' ? 'ag-text-right' : 'ag-text-left',
    editing
      ? 'ag-border-neutral-200 focus:ag-bg-neutral-100 dark:ag-border-neutral-600 dark:focus:ag-bg-neutral-700'
      : 'ag-border-transparent hover:ag-border-neutral-200 dark:hover:ag-border-neutral-600',
    disabled ? 'ag-cursor-not-allowed ag-opacity-60' : 'ag-cursor-text',
  );
  const input = (
    <input
      ref={inputRef}
      type="text"
      inputMode={inputMode ?? (typeof value === 'number' ? 'decimal' : undefined)}
      aria-label={label}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      disabled={disabled}
      readOnly={!editing || pending}
      value={editing ? draft : display}
      placeholder={placeholder}
      onClick={start}
      onChange={event => setDraft(event.target.value)}
      className={cx(controlClass, 'ag-col-start-1 ag-row-start-1')}
      style={{font: 'inherit', ...(!renderEditor && !renderValue ? {width: 0, minWidth: '100%'} : {})}}
    />
  );

  return (
    <Text
      as="div"
      ref={forwardedRef as React.Ref<HTMLElement>}
      variant={variant}
      bold={bold}
      className={cx('ag-inline-grid ag-min-w-0 ag-max-w-full', !variant && metrics.text, className)}
      style={style}
      aria-busy={pending || undefined}
      onKeyDown={event => {
        if (event.defaultPrevented || event.nativeEvent.isComposing || disabled) return;
        if (!active.current) {
          if (event.key === 'Enter' && !renderEditor && !renderValue) {
            event.preventDefault();
            start();
          }
          return;
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          cancel();
        } else if (event.key === 'Enter' && commitOnEnter && !event.shiftKey) {
          event.preventDefault();
          void commit();
        }
      }}
      onBlur={event => {
        if (!active.current || !commitOnBlur || event.currentTarget.contains(event.relatedTarget as Node | null))
          return;
        void commit(false);
      }}
    >
      {renderEditor || renderValue ? (
        editing ? (
          <div ref={editorRef}>
            {renderEditor
              ? renderEditor({draft, setDraft, commit: () => commit(), cancel, pending, error, label})
              : input}
          </div>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            aria-label={`Edit ${label}`}
            onClick={start}
            className={controlClass}
            style={{font: 'inherit'}}
          >
            {renderValue ? renderValue(value) : display || placeholder}
          </button>
        )
      ) : (
        <>
          {/* The committed display and raw text reserve the same width in both modes. */}
          <span
            aria-hidden="true"
            className={cx(controlClass, 'ag-invisible ag-col-start-1 ag-row-start-1 ag-whitespace-pre')}
          >
            {display || placeholder || '\u00a0'}
          </span>
          <span
            aria-hidden="true"
            className={cx(controlClass, 'ag-invisible ag-col-start-1 ag-row-start-1 ag-whitespace-pre')}
          >
            {raw || '\u00a0'}
          </span>
          {input}
        </>
      )}
      {error && (
        <span id={errorId} role="alert" className="ag-text-sm ag-text-red-600 dark:ag-text-red-400">
          {error}
        </span>
      )}
    </Text>
  );
}

/** Click/Enter to edit; Escape cancels. Custom editors share a string draft and explicit save/cancel API. */
export const InlineEdit = React.forwardRef(InlineEditImpl) as <T = string>(
  props: InlineEditProps<T> & React.RefAttributes<HTMLDivElement>,
) => React.ReactElement | null;
