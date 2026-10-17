const EMPTY_VALUE = "EMPTY";

/** @param {any} v
 * @param {import('./queries').GroupWith} atomizeWith
 * */
function atomKey(v, atomizeWith) {
  if (v == null) return null;

  const keys = atomizeWith === "name" ? ["name", "email", "id"] : ["id", "name", "email"];

  if (typeof v === "object") {
    for (const key of keys) if (typeof v[key] === "string") return v[key];

    // fallback to JSON stringification
    console.warn("Warning: Object value with unexpected structure, falling back to JSON stringification.", v);
    return JSON.stringify(v);
  }

  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return v.toString();

  console.warn("Warning: Unexpected value type, falling back to string conversion.", v);
  return String(v);
}

/** @param {any} v
 * @param {import('./queries').GroupWith} atomizeWith
 * @return {any|null}
 */
function atomize(v, atomizeWith) {
  if (v == null) return null;
  if (v == "") return null;

  const keys = atomizeWith === "name" ? ["name", "email", "id"] : ["id", "name", "email"];

  if (typeof v === "object") {
    for (const key of keys) if (typeof v[key] === "string") return v[key];

    return `json:${JSON.stringify(v)}`; // last resort
  }

  return v;
}

/** @param {any} raw
   * @param {import('./queries').GroupWith} atomizeWith
 * @returns {string | Array<string> | null}
 */
function normalizeCellValue(raw, atomizeWith = "name") {
  if (raw == null) return null;

  if (Array.isArray(raw)) {
    if (raw.length === 0) return [];

    const atoms = raw.map((v) => atomize(v, atomizeWith)).filter((x) => x != null);
    // stable order (useful if you later build composite group keys)

    return atoms.sort((a, b) => a.localeCompare(b));
  }

  return atomize(raw, atomizeWith);
}

/** @param {any} expected
   * @param {import('./queries').GroupWith} atomizeWith
 *  @return {string|null}
 */
function normalizeExpected(expected, atomizeWith = "name") {
  return atomize(expected, atomizeWith);
}

/**
 * Returns an array of *one-or-more* keys for a field.
 * - single value -> [key]
 * - array value  -> [key1, key2, ...]  (exploded)
 * - empty/null   -> [EMPTY_VALUE]
 @param {any} raw 
@param {import('./queries').GroupWith} explodeWith
   */
function explodeFieldKeys(raw, explodeWith = "name") {
  if (raw == null) return [EMPTY_VALUE];

  if (!Array.isArray(raw)) return [atomKey(raw, explodeWith) ?? EMPTY_VALUE];

  if (raw.length === 0) return [EMPTY_VALUE];

  // unique & stable order
  const set = new Set(
    raw
      .map((v) => atomKey(v, explodeWith))
      .filter((/**@type {string | null}*/ k) => k != null)
      .sort(),
  );

  const keys = Array.from(set);
  return keys.length > 0 ? keys : [EMPTY_VALUE];
}

/** @param {Array<Array<any>>} arrays
 * @return {Array<Array<any>>}
 * */
function cartesianProduct(arrays) {
  let acc = [[]];

  for (const arr of arrays) {
    const next = [];

    for (const prefix of acc) {
      for (const v of arr) next.push([...prefix, v]);
    }

    acc = next;
  }

  return acc;
}
export default {

  explodeFieldKeys,
  cartesianProduct,
  normalizeCellValue,
  normalizeExpected,
};
