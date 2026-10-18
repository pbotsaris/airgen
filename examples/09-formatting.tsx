/**
 * Formatting and parsing by a field's own settings.
 *
 * Every `FieldInspector` from `useFields` formats a value the way its field
 * is configured in Airtable: currency symbol and precision, percent,
 * duration and date formats, the time zone of a dateTime. `format` takes any
 * value, not just a cell, so a total or a draft renders like the column it
 * belongs to. `parse` is the strict inverse: it returns `{ok: false, error}`
 * for text it can't read rather than guessing, and the error carries an
 * example in the field's own format.
 *
 * Separators and month names follow `{locale}` (default: the viewer's); the
 * symbol and date order are the field's. A `YYYY-MM-DD` date cell is the same
 * day in every time zone.
 */
import React, {useState} from 'react';
import {aggregate} from 'airgen';
import {useFields, useMutations, useRecords} from './airtable-schema';
import type {ProjectsRecord} from './airtable-schema';

export function BudgetColumn() {
  const projects = useRecords('Projects');
  const fields = useFields('Projects');
  const {total} = aggregate(projects, {total: {field: 'budget', op: 'sum'}});

  return (
    <table>
      <tbody>
        {projects.map(project => (
          <tr key={project.id}>
            <td>{project.name}</td>
            {/* The row's cell, read by field ID: "$98,000.00" for a $ field with precision 2. */}
            <td>{fields.budget.formatCell(project)}</td>
            {/* A typed value formats the same way; "" for an empty cell. */}
            <td>{fields.startDate.format(project.fields.startDate)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td>Total</td>
          {/* Not a cell: a number formatted like the budget column, in Brazilian separators. */}
          <td>{fields.budget.format(total, {locale: 'pt-BR'})}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

/**
 * A text input that saves only what parses. `parse` yields the cell value
 * (`number | null` here; `null` for empty text, which clears the cell). With
 * `@airgen/ui`'s `InlineEdit`, pass `format={v => budget.format(v)}` and a
 * `parse` that throws `new Error(result.error)` when `!result.ok`.
 */
export function BudgetInput({project}: {project: {id: string; fields: Partial<ProjectsRecord>}}) {
  const budget = useFields('Projects').budget;
  const projects = useMutations('Projects');
  const [draft, setDraft] = useState(() => budget.format(project.fields.budget));
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const result = budget.parse(draft); // "1,234.5", "$1,234.50" and "1234.5" all read as 1234.5
    if (!result.ok) return setError(result.error); // "Enter an amount such as $1,234.50."
    setError(null);
    setDraft(budget.format(result.value));
    void projects.update(project, 'budget', result.value);
  };

  return (
    <label>
      {budget.name}
      <input value={draft} onChange={event => setDraft(event.target.value)} onBlur={save} />
      {error && <em>{error}</em>}
    </label>
  );
}
