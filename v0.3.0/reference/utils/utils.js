/** * Formats a number as a monetary value with two decimal places.
 ** @param {number|string} amount - The monetary amount to format.
 ** @param {string} currencySymbol - The currency symbol to prepend (default is "$").
 ** @param {"."|","} [decimalSeparator="."] - Decimal separator: "." formats as 1,234.50, "," formats as 1.234,50.
 */
function formatMoney(amount, currencySymbol = '$', decimalSeparator = '.') {
   const intlLocale = decimalSeparator === ',' ? 'pt-BR' : 'en-US'
   const zero = new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
   }).format(0)

   if (typeof amount === 'string') {
      if (amount.trim() === '') return `${currencySymbol}${zero}`

      // Clean up already-formatted strings ("1,234.50", "1.234,50", "R$ 1.234,50")
      // regardless of their separators before reformatting to the requested style.
      if (!/\d/.test(amount)) {
         console.warn('Invalid amount string provided to formatMoney:', amount)
         return `${currencySymbol}${zero}`
      }

      amount = parseMoney(amount)
   }

   if (amount === null || amount === undefined || isNaN(amount)) {
      console.warn('Invalid amount provided to formatMoney:', amount)
      return `${currencySymbol}${zero}`
   }

   const formatted = new Intl.NumberFormat(intlLocale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
   }).format(amount)

   return `${currencySymbol}${formatted}`
}

/**
 * @param {number} n
 * @param {number} min
 * @param {number} max
 */
function clamp(n, min, max) {
   return Math.max(min, Math.min(max, n))
}

/**
 * Merge refs (function refs or object refs).
 * @template T
 * @param  {...(import('react').Ref<T>|undefined)} refs
 * @returns {(value:T)=>void}
 */
function mergeRefs(...refs) {
   return (value) => {
      for (const ref of refs) {
         if (!ref) continue
         if (typeof ref === 'function') ref(value)
         else ref.current = value
      }
   }
}

/** * Rounds a number to a specified number of decimal places.
 * @param {number} n - The number to round.
 * @param {number} [decimals=4] - The number of decimal places to round to.
 * @returns {number} - The rounded number.
 */
function roundTo(n, decimals = 4) {
   if (decimals < 0) throw new Error('Decimal places must be non-negative')

   if (typeof n !== 'number' || isNaN(n)) {
      throw new Error('Input must be a valid number')
   }

   const p = 10 ** decimals
   return Math.round(n * p) / p
}

/**
 * Parses a monetary string into a number.
 * Handles US (1,234.50) and EU/BR (1.234,50) formats.
 * Strips currency symbols and whitespace.
 * @param {string|number|null|undefined} input
 * @returns {number}
 */
function parseMoney(input) {
   if (typeof input === 'number') return input
   if (input == null) return 0

   const cleaned = String(input).replace(/[^\d.,-]/g, '')
   if (!cleaned) return 0

   const normalized = normalizeDecimalSeparators(cleaned)
   const result = parseFloat(normalized)
   return isNaN(result) ? 0 : result
}

/** @param {string} str */
function normalizeDecimalSeparators(str) {
   const commas = (str.match(/,/g) || []).length
   const dots = (str.match(/\./g) || []).length

   if (commas > 0 && dots > 0) return stripByLastSeparator(str)
   if (commas > 1) return str.replace(/,/g, '')
   if (dots > 1) return str.replace(/\./g, '')
   if (commas === 1) return resolveSingleComma(str)
   return str
}

/** @param {string} str */
function stripByLastSeparator(str) {
   const lastComma = str.lastIndexOf(',')
   const lastDot = str.lastIndexOf('.')
   if (lastComma > lastDot) return str.replace(/\./g, '').replace(',', '.')
   return str.replace(/,/g, '')
}

/** @param {string} str */
function resolveSingleComma(str) {
   const afterComma = str.length - str.lastIndexOf(',') - 1
   if (afterComma === 3) return str.replace(',', '')
   return str.replace(',', '.')
}

/**
 * @typedef {Object} ParsedMoney
 * @property {number} number - The parsed numeric value.
 * @property {string} currencySymbol - The currency symbol found in the input (default "$").
 * @property {"."|","} format - The detected decimal separator.
 */

/**
 * Parses a formatted monetary string back into its parts: the numeric value,
 * the currency symbol, and the decimal separator used.
 * Handles US (1,234.50) and EU/BR (1.234,50) formats.
 * @param {string|number|null|undefined} input
 * @returns {ParsedMoney}
 */
function parseMoneyDetailed(input) {
   const number = parseMoney(input)

   if (typeof input === 'number' || input == null) {
      return { number, currencySymbol: '$', format: '.' }
   }

   const str = String(input)
   const symbol = str.replace(/[\d.,\s-]/g, '').trim()

   const numeric = str.replace(/[^\d.,-]/g, '')

   return {
      number,
      currencySymbol: symbol || '$',
      format: detectDecimalSeparator(numeric),
   }
}

/**
 * Detects the decimal separator used in a cleaned numeric string.
 * @param {string} str
 * @returns {"."|","}
 */
function detectDecimalSeparator(str) {
   const commas = (str.match(/,/g) || []).length
   const dots = (str.match(/\./g) || []).length

   if (commas > 0 && dots > 0) {
      return str.lastIndexOf(',') > str.lastIndexOf('.') ? ',' : '.'
   }
   if (commas === 1 && dots === 0) {
      const afterComma = str.length - str.lastIndexOf(',') - 1
      return afterComma === 3 ? '.' : ','
   }
   if (dots > 1) return ','
   return '.'
}

const inspect = (value) => {
   if (typeof value === 'object') {
      return JSON.stringify(value, null, 2)
   }

   return String(value)
}

/** @typedef {Object} RGBAColor
 * @property {number} r - Red component (0-255)
 * @property {number} g - Green component (0-255)
 * @property {number} b - Blue component (0-255)
 * @property {()=> string} toString - Returns the RGBA color string (e.g., "rgba(255, 87, 51, 0.5)").
 */

/** @param {string} hex - The hex color code (e.g., "#FF5733").
 * @param {number} [alpha=1] - The alpha value (opacity) between 0 and 1.
 * @returns {RGBAColor} The RGBA color string (e.g., "rgba(255, 87, 51, 0.5)").
 */

export function hexToRgba(hex, alpha = 1) {
   hex = hex.replace('#', '')
   const rgba = {}

   rgba.r = parseInt(hex.slice(0, 2), 16)
   rgba.g = parseInt(hex.slice(2, 4), 16)
   rgba.b = parseInt(hex.slice(4, 6), 16)
   rgba.a = alpha
   rgba.toString = () => `rgba(${rgba.r}, ${rgba.g}, ${rgba.b}, ${rgba.a})`

   return rgba
}

export default { formatMoney, parseMoney, parseMoneyDetailed, clamp, mergeRefs, roundTo, inspect }
