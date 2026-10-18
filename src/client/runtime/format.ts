/**
 * Field-aware display formatting and strict parsing: a value rendered the way
 * its Airtable field is configured (currency symbol and precision, percent,
 * duration, date and time formats, time zone), and text parsed back into that
 * field's value.
 *
 * Built on `Intl` and the field's `options` alone, so it formats any value,
 * not just a cell: a sum, a draft, a value computed elsewhere. Never throws:
 * a type it has no format for falls back to `cellText`, an invalid locale or
 * time zone to the viewer's, and a bad parse is an `{ok: false}` result
 * rather than a quiet `0`.
 */

import {cellText} from './queries.js';

type Options = {readonly [key: string]: unknown};

/** What formatting reads off a field: an SDK field, a `FieldInspector`, or a plain `{type, options}`. */
export interface FormatSource {
  readonly type?: string | null;
  readonly options?: Options | null;
}

export interface FormatOptions {
  /** BCP 47 locale for separators and month names. Defaults to the viewer's. */
  readonly locale?: string;
  /** IANA time zone for dateTime values, overriding the field's. */
  readonly timeZone?: string;
}

export type ParseResult<T> = {readonly ok: true; readonly value: T} | {readonly ok: false; readonly error: string};

/** Types whose value (and options) come from `options.result`. */
export const RESULT_TYPES: ReadonlySet<string> = new Set(['formula', 'rollup', 'multipleLookupValues']);

const TEXT_TYPES = new Set(['singleLineText', 'multilineText', 'richText', 'email', 'url', 'phoneNumber']);
const INTEGER_TYPES = new Set(['rating', 'count', 'autoNumber']);

interface Spec {
  readonly type: string | null;
  readonly options: Options;
}

function resolve(source: FormatSource): Spec {
  const type = source.type ?? null;
  const options = source.options ?? {};

  if (type && RESULT_TYPES.has(type)) {
    const result = options.result as {type?: unknown; options?: Options | null} | undefined;
    if (result && typeof result.type === 'string') return {type: result.type, options: result.options ?? {}};
  }
  return {type, options};
}

function isObject(value: unknown): value is {readonly [key: string]: unknown} {
  return typeof value === 'object' && value !== null;
}

// ---------------------------------------------------------------------------
// Intl, cached and made total

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();

/** `make(locale)`, falling back to the viewer's locale when `locale` is invalid. */
function withLocale<T>(locale: string | undefined, make: (locale: string | undefined) => T): T {
  try {
    return make(locale);
  } catch {
    return make(undefined);
  }
}

function numberFormat(locale: string | undefined, digits: number | undefined): Intl.NumberFormat {
  const key = `${locale ?? ''}|${digits ?? ''}`;
  let format = numberFormats.get(key);
  if (!format) {
    const options = digits === undefined ? {} : {minimumFractionDigits: digits, maximumFractionDigits: digits};
    format = withLocale(locale, at => new Intl.NumberFormat(at, options));
    numberFormats.set(key, format);
  }
  return format;
}

function dateFormat(locale: string | undefined, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`;
  let format = dateFormats.get(key);
  if (!format) {
    format = withLocale(locale, at => {
      try {
        return new Intl.DateTimeFormat(at, options);
      } catch (error) {
        // An unknown time zone; any other RangeError is the locale's.
        if (!options.timeZone) throw error;
        return new Intl.DateTimeFormat(at, {...options, timeZone: undefined});
      }
    });
    dateFormats.set(key, format);
  }
  return format;
}

// ---------------------------------------------------------------------------
// Numbers

function precisionOf(options: Options, fallback: number | undefined): number | undefined {
  const precision = options.precision;
  return typeof precision === 'number' && Number.isInteger(precision) && precision >= 0 && precision <= 20
    ? precision
    : fallback;
}

function symbolOf(options: Options): string {
  return typeof options.symbol === 'string' ? options.symbol : '';
}

function formatNumber(spec: Spec, value: number, locale: string | undefined): string {
  switch (spec.type) {
    case 'currency': {
      // Airtable's symbol is free text (`R$`, `kr`), not an ISO code, so it is
      // prefixed by hand, sign first: -$1,234.50.
      const text = numberFormat(locale, precisionOf(spec.options, 2)).format(Math.abs(value));
      const negative = value < 0 && /[1-9]/.test(text);
      return `${negative ? '-' : ''}${symbolOf(spec.options)}${text}`;
    }
    case 'percent':
      // Cells hold the fraction: 0.5 is 50%.
      return `${numberFormat(locale, precisionOf(spec.options, undefined)).format(value * 100)}%`;
    case 'duration':
      return formatDuration(value, spec.options);
    default:
      return numberFormat(locale, INTEGER_TYPES.has(spec.type ?? '') ? 0 : precisionOf(spec.options, undefined)).format(
        value,
      );
  }
}

const DURATION_DECIMALS: {readonly [format: string]: number} = {
  'h:mm': -1,
  'h:mm:ss': 0,
  'h:mm:ss.S': 1,
  'h:mm:ss.SS': 2,
  'h:mm:ss.SSS': 3,
};

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

function formatDuration(seconds: number, options: Options): string {
  const format = typeof options.durationFormat === 'string' ? options.durationFormat : 'h:mm';
  const decimals = DURATION_DECIMALS[format] ?? -1;

  if (decimals < 0) {
    const minutes = Math.round(Math.abs(seconds) / 60);
    const sign = seconds < 0 && minutes > 0 ? '-' : '';
    return `${sign}${Math.floor(minutes / 60)}:${pad(minutes % 60)}`;
  }

  const scale = 10 ** decimals;
  const units = Math.round(Math.abs(seconds) * scale);
  const whole = Math.floor(units / scale);
  const sign = seconds < 0 && units > 0 ? '-' : '';
  const fraction = decimals ? `.${pad(units % scale, decimals)}` : '';
  return `${sign}${Math.floor(whole / 3600)}:${pad(Math.floor((whole % 3600) / 60))}:${pad(whole % 60)}${fraction}`;
}

// ---------------------------------------------------------------------------
// Dates

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

interface Parts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
}

/** A Date for a cell value, and whether it is a bare day (`YYYY-MM-DD`, read as UTC midnight). */
function toDate(value: unknown): {date: Date; isDay: boolean} | null {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : {date: value, isDay: false};
  if (typeof value !== 'string' && typeof value !== 'number') return null;

  const day = typeof value === 'string' ? ISO_DAY.exec(value) : null;
  const date = day ? new Date(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]))) : new Date(value);
  return isNaN(date.getTime()) ? null : {date, isDay: day !== null};
}

function partsOf(date: Date, timeZone: string | undefined): Parts {
  const format = dateFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });
  const parts: {[type: string]: number} = {};
  for (const part of format.formatToParts(date)) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: (parts.hour ?? 0) % 24,
    minute: parts.minute ?? 0,
  };
}

function formatName(options: Options, key: 'dateFormat' | 'timeFormat'): string | undefined {
  const format = options[key];
  return isObject(format) && typeof format.name === 'string' ? format.name : undefined;
}

/** The field's `timeZone` as an `Intl` zone: `utc` is UTC, `client` (or none) is the viewer's. */
function zoneOf(options: Options, override: string | undefined): string | undefined {
  if (override) return override;
  const zone = options.timeZone;
  if (zone === 'utc') return 'UTC';
  return typeof zone === 'string' && zone !== 'client' ? zone : undefined;
}

function formatDay(date: Date, options: Options, locale: string | undefined, timeZone: string | undefined): string {
  const {year, month, day} = partsOf(date, timeZone);

  switch (formatName(options, 'dateFormat')) {
    case 'iso':
      return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
    case 'us':
      return `${month}/${day}/${year}`;
    case 'european':
      return `${day}/${month}/${year}`;
    case 'friendly':
      return dateFormat(locale, {timeZone, year: 'numeric', month: 'long', day: 'numeric'}).format(date);
    default:
      return dateFormat(locale, {timeZone, year: 'numeric', month: 'numeric', day: 'numeric'}).format(date);
  }
}

function formatTime(date: Date, options: Options, timeZone: string | undefined): string {
  const {hour, minute} = partsOf(date, timeZone);
  if (formatName(options, 'timeFormat') === '24hour') return `${pad(hour)}:${pad(minute)}`;
  return `${hour % 12 || 12}:${pad(minute)}${hour < 12 ? 'am' : 'pm'}`;
}

function formatDate(spec: Spec, value: unknown, options: FormatOptions): string {
  const parsed = toDate(value);
  if (!parsed) return typeof value === 'string' ? value : '';

  if (spec.type === 'date') {
    // A bare day is the same day everywhere; a Date is the viewer's calendar day.
    const timeZone = parsed.isDay ? 'UTC' : options.timeZone;
    return formatDay(parsed.date, spec.options, options.locale, timeZone);
  }

  const timeZone = zoneOf(spec.options, options.timeZone);
  return `${formatDay(parsed.date, spec.options, options.locale, timeZone)} ${formatTime(parsed.date, spec.options, timeZone)}`;
}

// ---------------------------------------------------------------------------
// Formatting

function formatWith(spec: Spec, value: unknown, options: FormatOptions): string {
  if (value === null || value === undefined) return '';

  if (Array.isArray(value)) {
    return value
      .map(item =>
        formatWith(spec, isObject(item) && 'linkedRecordId' in item && 'value' in item ? item.value : item, options),
      )
      .filter(Boolean)
      .join(', ');
  }

  switch (spec.type) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'duration':
    case 'rating':
    case 'count':
    case 'autoNumber':
      if (typeof value !== 'number') return cellText(value);
      return isFinite(value) ? formatNumber(spec, value, options.locale) : '';
    case 'date':
    case 'dateTime':
    case 'createdTime':
    case 'lastModifiedTime':
      return formatDate(spec.type === 'date' ? spec : {...spec, type: 'dateTime'}, value, options);
    default:
      return cellText(value);
  }
}

/**
 * `value` as text, the way `source`'s field displays it:
 *
 * - number, currency, percent: the field's precision; currency prefixed with
 *   its symbol (`-$1,234.50`), percent from the fraction (`0.5` → `50%`)
 * - duration (seconds): the field's `h:mm[:ss[.SSS]]` format
 * - date: the field's format (`iso`, `us`, `european`, `friendly`, `local`).
 *   A `YYYY-MM-DD` cell is the same day in every time zone; a `Date` is the
 *   viewer's calendar day
 * - dateTime: date plus 12- or 24-hour time in the field's time zone
 *   (`options.timeZone` overrides it)
 * - formula, rollup, lookup: by their `result` type; lookups join their values
 * - anything else: `cellText`. `null`/`undefined` are `''`
 *
 * Separators and month names follow `options.locale` (default: the
 * viewer's); the symbol and the date order are the field's.
 */
export function formatValue(source: FormatSource, value: unknown, options: FormatOptions = {}): string {
  return formatWith(resolve(source), value, options);
}

// ---------------------------------------------------------------------------
// Parsing

function fail(error: string): ParseResult<never> {
  return {ok: false, error};
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function separators(locale: string | undefined): {group: string; decimal: string} {
  let group = ',';
  let decimal = '.';
  for (const part of numberFormat(locale, 1).formatToParts(1234567.5)) {
    if (part.type === 'group') group = part.value;
    if (part.type === 'decimal') decimal = part.value;
  }
  return {group, decimal};
}

function parseNumber(spec: Spec, text: string, options: FormatOptions): ParseResult<number> {
  const {group, decimal} = separators(options.locale);
  let body = text;

  const symbol = symbolOf(spec.options).trim();
  if (spec.type === 'currency' && symbol) body = body.replace(symbol, '');
  if (spec.type === 'percent') body = body.replace('%', '');
  body = body.replace(/\s/g, '').replace(/−/g, '-');

  // Groups are optional, but when present they must be every three digits.
  const grouped = /\s/.test(group) ? '' : `|\\d{1,3}(?:${escapeRegExp(group)}\\d{3})+`;
  const match = new RegExp(`^(-?)(\\d+${grouped})(?:${escapeRegExp(decimal)}(\\d+))?$`).exec(body);
  if (!match) {
    const sample = spec.type === 'percent' ? 0.125 : spec.type === 'duration' ? 5400 : 1234.5;
    const noun = spec.type === 'currency' ? 'an amount' : 'a number';
    return fail(`Enter ${noun} such as ${formatWith(spec, sample, options)}.`);
  }

  const digits = `${match[1]}${match[2].split(group).join('')}.${match[3] ?? '0'}`;
  // `e-2` keeps 12.5% exactly 0.125, where dividing by 100 can drift.
  const value = Number(spec.type === 'percent' ? `${digits}e-2` : digits);
  return {ok: true, value: value === 0 ? 0 : value};
}

function parseDuration(spec: Spec, text: string, options: FormatOptions): ParseResult<number> {
  const match = /^(-)?(\d+):([0-5]\d)(?::([0-5]\d)(?:[.,](\d{1,3}))?)?$/.exec(text.replace(/\s/g, ''));
  if (!match) return fail(`Enter a duration such as ${formatWith(spec, 5400, options)}.`);

  const seconds =
    Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4] ?? 0) + Number(`0.${match[5] ?? 0}`);
  return {ok: true, value: match[1] && seconds ? -seconds : seconds};
}

/** The order of year, month and day in the locale's numeric dates. */
function localeOrder(locale: string | undefined): string[] {
  const format = dateFormat(locale, {timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric'});
  const order = format
    .formatToParts(new Date(Date.UTC(2006, 10, 22)))
    .map(part => part.type)
    .filter(type => type === 'year' || type === 'month' || type === 'day');
  return order.length === 3 ? order : ['month', 'day', 'year'];
}

function parseDay(
  text: string,
  spec: Spec,
  locale: string | undefined,
): {year: number; month: number; day: number} | null {
  const pieces = text.replace(/\.$/, '').split(/[./\-\s]+/);
  if (pieces.length !== 3 || !pieces.every(piece => /^\d+$/.test(piece))) return null;

  let order: string[];
  if (/^\d{4}$/.test(pieces[0])) order = ['year', 'month', 'day'];
  else if (formatName(spec.options, 'dateFormat') === 'us') order = ['month', 'day', 'year'];
  else if (formatName(spec.options, 'dateFormat') === 'european') order = ['day', 'month', 'year'];
  else order = localeOrder(locale);

  const value: {[part: string]: number} = {};
  order.forEach((part, index) => (value[part] = Number(pieces[index])));
  const {year, month, day} = value;
  if (pieces[order.indexOf('year')].length !== 4) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return {year, month, day};
}

/** The instant a wall-clock time names in `timeZone` (the viewer's when undefined). */
function zonedTime(day: {year: number; month: number; day: number}, hour: number, minute: number, timeZone?: string) {
  if (!timeZone) return new Date(day.year, day.month - 1, day.day, hour, minute);

  const wall = Date.UTC(day.year, day.month - 1, day.day, hour, minute);
  const offset = (instant: number) => {
    const parts = partsOf(new Date(instant), timeZone);
    return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute) - instant;
  };
  // Twice, so a wall time next to a DST change settles on the right side.
  const first = wall - offset(wall);
  return new Date(wall - offset(first));
}

function parseDate(spec: Spec, text: string, options: FormatOptions): ParseResult<string> {
  const sample = spec.type === 'date' ? '2026-01-31' : new Date(Date.UTC(2026, 0, 31, 14, 30));
  const invalid = () => fail(`Enter a date such as ${formatWith(spec, sample, options)}.`);

  if (spec.type === 'date') {
    const day = parseDay(text, spec, options.locale);
    return day ? {ok: true, value: `${pad(day.year, 4)}-${pad(day.month)}-${pad(day.day)}`} : invalid();
  }

  // A full ISO timestamp names its own instant.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(text)) {
    const instant = new Date(text);
    return isNaN(instant.getTime()) ? invalid() : {ok: true, value: instant.toISOString()};
  }

  const match = /^(.+?)(?:[\sT,]+(\d{1,2}):(\d{2})\s*(am|pm)?)?$/i.exec(text);
  const day = match ? parseDay(match[1], spec, options.locale) : null;
  if (!match || !day) return invalid();

  let hour = Number(match[2] ?? 0);
  const minute = Number(match[3] ?? 0);
  const meridiem = match[4]?.toLowerCase();
  if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour === 0)) return invalid();
  if (meridiem) hour = (hour % 12) + (meridiem === 'pm' ? 12 : 0);

  return {ok: true, value: zonedTime(day, hour, minute, zoneOf(spec.options, options.timeZone)).toISOString()};
}

/**
 * `text` parsed into `source`'s field value, strictly: the inverse of
 * `formatValue` for the types a person types in.
 *
 * - number, currency, percent, rating: the locale's separators, groups of
 *   three or none (`1,234.5`, `1234.5`; `1,2,3` is refused), the field's
 *   symbol and `%` optional. Percent yields the fraction (`50%` → `0.5`)
 * - duration: `h:mm[:ss[.SSS]]`, in seconds
 * - date: `YYYY-MM-DD` or the field's order (`us`, `european`, else the
 *   locale's), as `YYYY-MM-DD`
 * - dateTime: a date plus optional `h:mm`/`h:mmam`, read in the field's time
 *   zone, or a full ISO timestamp; as an ISO string
 * - text types: the text as given
 *
 * Empty text is `null` (clears the cell). Anything unparseable is
 * `{ok: false, error}` with an example in the field's own format, ready to
 * show the user.
 */
export function parseValue(source: FormatSource, text: string, options: FormatOptions = {}): ParseResult<unknown> {
  const spec = resolve(source);
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed === '') return {ok: true, value: null};

  switch (spec.type) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'rating':
    case 'count':
    case 'autoNumber':
      return parseNumber(spec, trimmed, options);
    case 'duration':
      return parseDuration(spec, trimmed, options);
    case 'date':
    case 'dateTime':
      return parseDate(spec, trimmed, options);
    default:
      if (spec.type && TEXT_TYPES.has(spec.type)) return {ok: true, value: text};
      return fail(`A ${spec.type ?? 'field of unknown type'} value can't be parsed from text.`);
  }
}
