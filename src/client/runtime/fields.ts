/**
 * Null-safe inspection of one field: its live metadata, its choices, whether
 * it can be written, and conversion of a value into its cell write format.
 *
 * Built from the live SDK field (when the extension can see it) and the
 * generated meta entry, so a field hidden from the extension or deleted since
 * generation still inspects — it just reports a blocking issue for writes.
 * Never throws.
 */

import {writeKind} from '../field-types.js';
import type {WriteKind} from '../field-types.js';
import type {SdkField} from '../sdk.js';
import type {AirgenFieldMeta} from '../useTypedRecords.js';
import {ValidationResult} from './validation.js';
import type {ValidationIssue} from './validation.js';

export interface Choice {
  readonly id: string;
  readonly name: string;
  readonly color?: string;
}

/** Types whose value (and choices) come from `options.result`. */
const RESULT_TYPES = new Set(['formula', 'rollup', 'multipleLookupValues']);

type Options = {readonly [key: string]: unknown} | null | undefined;

function parseChoices(raw: unknown): Choice[] {
  if (!Array.isArray(raw)) return [];
  const choices: Choice[] = [];

  for (const choice of raw as Array<{id?: unknown; name?: unknown; color?: unknown}>) {
    if (typeof choice?.id !== 'string' || typeof choice?.name !== 'string') continue;
    choices.push({id: choice.id, name: choice.name, ...(typeof choice.color === 'string' && {color: choice.color})});
  }

  return choices;
}

function liveResult(options: Options): {type: string; options: Options} | null {
  const result = options?.result as {type?: unknown; options?: Options} | undefined;
  return result && typeof result.type === 'string' ? {type: result.type, options: result.options} : null;
}

function isObject(value: unknown): value is {readonly [key: string]: unknown} {
  return typeof value === 'object' && value !== null;
}

export class FieldInspector {
  /** Sanitized key from the generated meta ('' when inspected without one). */
  readonly fieldKey: string;
  /** The live field, or null when it's deleted or hidden from this extension. */
  readonly field: SdkField | null;
  readonly meta: AirgenFieldMeta | null;
  /** Display name: live, else generated, else the key. */
  readonly name: string;
  /** Live type when the field is visible, else the generated one. */
  readonly type: string | null;
  /** The type the value actually holds: unwraps formula/rollup/lookup `result`. */
  readonly resultType: string | null;
  /** Choices of a select, or of the select a lookup/formula resolves to; [] otherwise. */
  readonly choices: ReadonlyArray<Choice>;
  /** `null` when the type has no write format, `undefined` when airgen doesn't know the type. */
  readonly writeKind: WriteKind | null | undefined;
  readonly isWritable: boolean;
  /** Issues a write through this field raises; reads ignore it. */
  readonly validation: ValidationResult;

  constructor(field: SdkField | null, meta: AirgenFieldMeta | null | undefined, fieldKey = '') {
    this.fieldKey = fieldKey;
    this.field = field;
    this.meta = meta ?? null;
    this.name = field?.name ?? meta?.name ?? fieldKey;

    // A bare handle (no `type`) reads everything else from the meta too.
    const liveType = field?.type;
    const live = liveType !== undefined;
    this.type = liveType ?? meta?.type ?? null;

    let choiceSource: unknown;
    if (liveType !== undefined) {
      const result = RESULT_TYPES.has(liveType) ? liveResult(field?.options) : null;
      this.resultType = result?.type ?? liveType;
      choiceSource = (result ? result.options : field?.options)?.choices;
    } else {
      const result = this.type && RESULT_TYPES.has(this.type) ? meta?.result : undefined;
      this.resultType = result?.type ?? this.type;
      choiceSource = result ? result.choices : meta?.choices;
    }
    this.choices = parseChoices(choiceSource);

    this.writeKind = this.type === null ? null : writeKind(this.type);
    // The SDK's verdict wins over the type table, as in the generator.
    const isComputed = field?.isComputed ?? meta?.isComputed ?? this.writeKind === null;
    this.isWritable = field !== null && !isComputed && this.writeKind !== null;

    this.validation = new ValidationResult(this.writeIssues(live));
  }

  private writeIssues(live: boolean): ValidationIssue[] {
    const issue = (
      kind: ValidationIssue['kind'],
      level: ValidationIssue['level'],
      message: string,
    ): ValidationIssue => ({
      kind,
      level,
      message,
      ...(this.fieldKey && {fieldKey: this.fieldKey}),
    });

    if (!this.meta) return [issue('field-unknown', 'error', `Field "${this.name}" is not in the generated schema.`)];

    if (!this.field) {
      return [issue('field-missing', 'error', `Field "${this.name}" is deleted or hidden from this extension.`)];
    }

    if (live && this.type !== this.meta.type) {
      return [
        issue(
          'field-type-changed',
          'error',
          `Field "${this.name}" changed type from ${this.meta.type} to ${this.type}; regenerate the schema before writing to it.`,
        ),
      ];
    }
    if (!this.isWritable)
      return [issue('field-not-writable', 'error', `Field "${this.name}" (${this.type}) is not writable.`)];
    if (this.writeKind === undefined) {
      return [
        issue(
          'field-type-unknown',
          'warning',
          `Field "${this.name}" has a field type airgen doesn't know (${this.type}); its value is written unconverted.`,
        ),
      ];
    }
    return [];
  }

  getChoiceById(id: string): Choice | null {
    return this.choices.find(choice => choice.id === id) ?? null;
  }

  /** Case-insensitive. */
  getChoiceByName(name: string): Choice | null {
    const wanted = name.toLowerCase();
    return this.choices.find(choice => choice.name.toLowerCase() === wanted) ?? null;
  }

  /**
   * `value` in this field's cell write format. Accepts read shapes (what
   * `getCellValue` returns) and write shapes alike, and is idempotent, so a
   * value can be copied from one record to another or passed through twice:
   *
   * - selects: `{id, name, color}` → `{id}`; `{name}` and a bare string resolve
   *   against the choices (id first, then case-insensitive name) to `{id}`,
   *   or stay `{name}` when no choice matches, for the SDK to reject
   * - collaborators: `{id, ...}` or a bare id → `{id}`
   * - record links: `{id, name}` or a bare id → `{id}`; `{name}` is kept (the
   *   interface SDK creates and links a record from it)
   * - attachments, scalars, dates: unchanged
   *
   * `null` clears, `undefined` stays `undefined` (the mutation layer omits
   * it). Values for computed and unknown types pass through unchanged — the
   * inspector's `validation` is what reports them.
   */
  convertTo(value: unknown): unknown {
    if (value === null || value === undefined) return value;

    switch (this.writeKind) {
      case 'singleChoice':
        return this.toChoiceRef(value);
      case 'multiChoice':
        return this.toList(value, item => this.toChoiceRef(item));
      case 'collaborator':
        return toIdRef(value);
      case 'collaborators':
        return this.toList(value, toIdRef);
      case 'links':
        return this.toList(value, toLinkRef);
      default:
        return value;
    }
  }

  private toList(value: unknown, convert: (item: unknown) => unknown): unknown[] {
    const items = Array.isArray(value) ? value : [value];
    return items.filter(item => item !== null && item !== undefined).map(convert);
  }

  private toChoiceRef(value: unknown): unknown {
    if (typeof value === 'string') {
      const choice = this.getChoiceById(value) ?? this.getChoiceByName(value);
      return choice ? {id: choice.id} : {name: value};
    }
    if (!isObject(value)) return value;
    if (typeof value.id === 'string') return {id: value.id};
    if (typeof value.name === 'string') {
      const choice = this.getChoiceByName(value.name);
      return choice ? {id: choice.id} : {name: value.name};
    }
    return value;
  }
}

function toIdRef(value: unknown): unknown {
  if (typeof value === 'string') return {id: value};
  if (isObject(value) && typeof value.id === 'string') return {id: value.id};
  return value;
}

function toLinkRef(value: unknown): unknown {
  if (typeof value === 'string') return {id: value};
  if (!isObject(value)) return value;
  if (typeof value.id === 'string') return {id: value.id};
  if (typeof value.name === 'string') return {name: value.name};
  return value;
}

/** Inspector for a live field (null when hidden or deleted) and its generated meta entry. */
export function inspectField(
  field: SdkField | null,
  meta: AirgenFieldMeta | null | undefined,
  fieldKey?: string,
): FieldInspector {
  return new FieldInspector(field, meta, fieldKey);
}
