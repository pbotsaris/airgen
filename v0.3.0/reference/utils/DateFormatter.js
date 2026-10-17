/** @typedef {'numeric' | '2-digit' | undefined} YearFormat */
/** @typedef {'long' | 'short' | 'narrow' | '2-digit' |  undefined} MonthFormat */
/** @typedef {'numeric' | '2-digit' | undefined} DayFormat */
/** @typedef {'long' | 'short' | 'narrow' | undefined} WeekdayFormat */
/** @typedef {'en-US'| 'pt-BR' } Locales */

/** @typedef {Object} FormatOptions
 * @property {YearFormat} year
 * @property {MonthFormat} month
 * @property {DayFormat} day
 * @property {WeekdayFormat} weekday
 */

const DEFAULT_OPTS = /** @type {FormatOptions} */ ({
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  weekday: undefined,
});

export default class DateFormatter {
  /** @param {string | null} maybeDateStr
   * @param {FormatOptions} [defaultOptions]
   * */
  constructor(maybeDateStr, defaultOptions = DEFAULT_OPTS) {
    this.date = maybeDateStr ? new Date(maybeDateStr) : null;
    this.defaultOptions = defaultOptions;
  }

  /** @param {YearFormat} format */
  setYearFormat(format) {
    this.defaultOptions.year = format;
    return this;
  }

  /** @param {MonthFormat} format */
  setMonthFormat(format) {
    this.defaultOptions.month = format;
    return this;
  }

  /** @param {DayFormat} format */
  setDayFormat(format) {
    this.defaultOptions.day = format;
    return this;
  }

  /** @param {WeekdayFormat} format */
  setWeekdayFormat(format) {
    this.defaultOptions.weekday = format;
    return this;
  }

  /** @param {Locales} locale */
  format(locale) {
    if (!this.date) return "invalid date";
    return this.date.toLocaleDateString(locale, this.defaultOptions);
  }
}
