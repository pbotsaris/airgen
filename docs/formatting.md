# Formatting and parsing

Every `FieldInspector` from `useFields` formats values the way its field is configured in Airtable, and parses text back into that field's cell value. It reads only `Intl` and the live field's `options`. There is no extra dependency and nothing to configure.

```tsx
const fields = useFields('Projects');

fields.budget.formatCell(row);                     // "$98,000.00": the row's cell, read by field ID
fields.budget.format(total);                       // any number, formatted like the column
fields.budget.format(total, {locale: 'pt-BR'});    // "$98.000,00": the locale's separators, the field's symbol
fields.startDate.format('2026-10-08');             // in the field's date format, the 8th everywhere
fields.budget.parse('1.234,50', {locale: 'pt-BR'}); // {ok: true, value: 1234.5}
```

Outside React, `formatValue(source, value, options)` and `parseValue(source, text, options)` take any `{type, options}`: an SDK field, an inspector's live field, or a literal.

## What each type formats as

| Type | Output |
|---|---|
| `number` | The field's precision, grouped: `1,234.6` |
| `currency` | The field's symbol and precision, sign first: `-R$1,234.50`. Airtable's symbol is free text, so it is prefixed as is. |
| `percent` | From the fraction, at the field's precision: `0.125` → `12.5%` |
| `rating`, `count`, `autoNumber` | Integers |
| `duration` | Seconds in the field's `h:mm`, `h:mm:ss`, or `h:mm:ss.S`–`.SSS` |
| `date` | The field's `iso`, `us`, `european`, `friendly` (`October 8, 2026`), or `local` format |
| `dateTime`, `createdTime`, `lastModifiedTime` | Date plus `3:05pm` or `15:05`, in the field's time zone |
| `formula`, `rollup`, lookup | By the `result` type; lookups join their values with `, ` |
| anything else | `cellText`: choice names, collaborator names, link names |

`null` and `undefined` format as `''`. A non-finite number also formats as `''`. A value of the wrong shape (text in a number column) falls back to `cellText`.

### Locale and time zone

`{locale}` controls separators and month names. It defaults to the viewer's locale, like Airtable's "local" setting. The currency symbol and the date order (`us`, `european`, `iso`) always come from the field.

A date-only cell (`YYYY-MM-DD`) shows the same day in every time zone. Formatting `new Date('2026-10-08')` naively shows the 7th in the Americas. A `Date` object passed to a date field is the viewer's calendar day, so `format(new Date())` is today.

A dateTime renders in the field's time zone: `utc`, `client` (the viewer's), or a named zone. `{timeZone}` overrides it. An invalid locale or zone falls back to the viewer's.

## Parsing

`parse(text)` returns `{ok: true, value}` or `{ok: false, error}`. It never returns a guessed number. The error includes an example in the field's own format (`Enter an amount such as $1,234.50.`), so it is ready to show the user.

| Type | Accepts | Yields |
|---|---|---|
| number, currency, percent, rating | The locale's separators. Groups are optional, but every group must have three digits. The symbol and `%` are optional. `1,234.5` and `1234.5` work; `1,2,3` and `12-34` don't. | `number`; percent yields the fraction |
| duration | `h:mm`, `h:mm:ss`, `h:mm:ss.SSS` | seconds |
| date | `YYYY-MM-DD`, or the field's order (`us`, `european`, else the locale's) with a four-digit year | `YYYY-MM-DD` |
| dateTime | A date plus an optional `15:05` or `3:05pm`, read in the field's time zone; or a full ISO timestamp | ISO string |
| text types | The text as given | `string` |

Empty text parses to `null`, which clears the cell. Other types (selects, links, attachments) return `{ok: false}`. Use `convertTo` and the choice helpers for those.

For a field from `useFields`, `parse`'s result is typed by the field: `number | null` for a currency field, `string | null` for a date. To wire it into `@airgen/ui`'s `InlineEdit`:

```tsx
<InlineEdit
  value={budget}
  format={value => fields.budget.format(value)}
  parse={draft => {
    const result = fields.budget.parse(draft);
    if (!result.ok || result.value === null) throw new Error(result.ok ? 'Enter an amount.' : result.error);
    return result.value;
  }}
  onCommit={async amount => {
    await projects.update(row, 'budget', amount);
  }}
  label="Budget"
/>
```

## Fidelity

Output is built from Airtable's documented field options, not from Airtable's renderer. It matches the grid for the formats above, with two known differences. First, Airtable's `local` and `friendly` dates follow its own locale data, which can differ slightly from the browser's `Intl`. Second, number fields always use grouping separators. For exactly what Airtable shows in a cell, `row.raw.getCellValueAsString(fieldId)` is still available, but it covers only existing cells and has no parse.

A field that is hidden or deleted formats by its generated type with default options (precision 2 for currency, no symbol). `formatCell` returns `''` for such a field. None of this throws.
