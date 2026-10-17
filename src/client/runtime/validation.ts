/**
 * Warnings vs blocking errors, for writes.
 *
 * Reads never block: a missing field reads as absent and rendering carries on.
 * Writes do — an error anywhere in a write's result refuses the whole write
 * before anything reaches the SDK, because Airtable has no transactions to
 * undo half of one. Warnings ride along on the result and never block.
 */

export type ValidationLevel = 'error' | 'warning';

export type ValidationKind =
  /** The table isn't in this base, or is hidden from this extension. */
  | 'table-missing'
  /** A write named a field key the generated meta doesn't have. */
  | 'field-unknown'
  /** The field is in the meta but deleted from the base, or hidden from this extension. */
  | 'field-missing'
  /** The live field's type differs from the generated one, so the write type is stale. */
  | 'field-type-changed'
  /** Computed, or a type with no cell write format. */
  | 'field-not-writable'
  /** A field type newer than this airgen release: values pass through unconverted. */
  | 'field-type-unknown'
  /** A table picked in a custom property has no field matching a generated one (resolver.ts). */
  | 'field-unresolved'
  /** A table picked in a custom property has the field, but with another type (resolver.ts). */
  | 'field-incompatible'
  /** `customProperties` was configured on an SDK flavor without custom properties. */
  | 'custom-properties-unsupported';

export interface ValidationIssue {
  readonly kind: ValidationKind;
  readonly level: ValidationLevel;
  readonly message: string;
  /** Sanitized field key from the generated meta, when the issue is about one field. */
  readonly fieldKey?: string;
}

export class ValidationResult {
  static readonly ok = new ValidationResult([]);

  /** One result holding every issue of `results`, in order. */
  static merge(results: ReadonlyArray<ValidationResult>): ValidationResult {
    const issues = results.flatMap(result => result.issues);
    return issues.length === 0 ? ValidationResult.ok : new ValidationResult(issues);
  }

  readonly issues: ReadonlyArray<ValidationIssue>;

  constructor(issues: ReadonlyArray<ValidationIssue>) {
    this.issues = issues;
  }

  get errors(): ReadonlyArray<ValidationIssue> {
    return this.issues.filter(issue => issue.level === 'error');
  }

  get warnings(): ReadonlyArray<ValidationIssue> {
    return this.issues.filter(issue => issue.level === 'warning');
  }

  /** True when nothing blocks: warnings alone are valid. */
  valid(): boolean {
    return this.issues.every(issue => issue.level !== 'error');
  }

  /** Every message, one per line ('' when there are no issues). */
  reason(): string {
    return this.issues.map(issue => issue.message).join('\n');
  }
}
