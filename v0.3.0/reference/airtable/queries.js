import { Table, Record, Field } from "@airtable/blocks/interface/models";
import Fuse from "fuse.js";
import airtableUtils from "./airtableUtils.js";

/** @typedef {'is' | 'not' | 'anyof' | 'noneof' | 'empty'} Operator */
/** @typedef {'AND' | 'OR'} LogicalOperator */
/** @typedef {'group' | 'array'} ApplyResultType */
/** @typedef {[ApplyResultType, Object<string, Array<Record>> | Array<Record>]} ApplyResult */
  /** @typedef {'name' | 'id'} GroupWith */

/** @exports {ApplyResult}
   * @exports {GroupWith}
   * */


class GroupBy {
      /** @param {Field} field
      * @param { GroupWith} groupWith
      */
   constructor(field, groupWith) {
       /** @type {Field} */
       this.field = field;
    
       /** @type { GroupWith} */
       this.groupWith = groupWith;
    }
}

class Filter {
  /** @param {Field} field */
  constructor(field) {
    /** @type {Field} */
    this.field = field;

    /** @type {Operator | null} */
    this.operator = null;

    /** @type {any | null} */
    this.value = null;

    this.active = false;
  }

  /** @param {Operator} operator
   * @param {string | number | boolean| Array<string> | null} value */
  activate(operator, value) {
    if (this.active)
      return console.warn(
        `Airtable Query: Filter on field "${this.field.name}" is already active with operator "${this.operator}". Ignoring it.`,
      );

    this.operator = operator;
    this.value = value;
    this.active = true;
  }

  /** @param {Record} record */
  apply(record) {
    const actual = airtableUtils.normalizeCellValue(record.getCellValue(this.field));
    const expectedSingle = airtableUtils.normalizeExpected(this._resolveShouldBeSingle());
    const expectedList = this._resolveShouldBeArray().map((e) => airtableUtils.normalizeExpected(e));

    switch (this.operator) {
      case "is":
        if (Array.isArray(actual)) return expectedSingle != null && actual.includes(expectedSingle);
        return actual === expectedSingle;

      case "not":
        if (Array.isArray(actual)) return expectedSingle == null ? actual.length > 0 : !actual.includes(expectedSingle);
        return actual !== expectedSingle;

      case "anyof":
        if (Array.isArray(actual)) return expectedList.some((e) => e != null && actual.includes(e));
        return expectedList.some((e) => actual === e);

      case "noneof":
        if (Array.isArray(actual)) return !expectedList.some((e) => e != null && actual.includes(e));
        return !expectedList.some((e) => actual === e);

      case "empty":
        if (actual == null) return true;
        if (Array.isArray(actual)) return actual.length === 0;
        return actual === "";

      default:
        throw new Error(`Airtable Query: Unknown operator "${this.operator}".`);
    }
  }

  /**
   * @return {Array<number | string>}
   **/
  _resolveShouldBeArray() {
    if (this.value === null || this.value === undefined)
      throw new Error(`Airtable Query: Expected a value for operator "${this.operator}", but got null or undefined.`);

    if (!Array.isArray(this.value)) {
      console.warn(
        `Airtable Query: Expected an array value for operator "${this.operator}", but got "${typeof this.value}". Wrapping it in an array.`,
      );
      return [this.value];
    }
    return this.value;
  }

  /**
   * @return {number | string}
   * */
  _resolveShouldBeSingle() {
    if (this.value === null || this.value === undefined)
      throw new Error(`Airtable Query: Expected a value for operator "${this.operator}", but got null or undefined.`);

    if (Array.isArray(this.value)) {
      console.warn(
        `Airtable Query: Expected a single value for operator "${this.operator}", but got an array. Taking the first element.`,
      );
      return this.value[0];
    }
    return this.value;
  }
}

export default class Query {
  /** @param {Table} table
   * @param {LogicalOperator} logicalOperator
   * */
  constructor(table, logicalOperator = "AND") {
    /** @type {Table} */
    this.table = table;

    /** @type {LogicalOperator} */
    this.logicalOperator = logicalOperator;

    /** @type {Array<GroupBy>} */
    this.groupBys = [];

    /** @type {Filter[]} */
    this.filters = [];

    /** @type {Field|null} */
    this._searchField = null;

    /** @type {string} */
    this._searchQuery = "";
  }

  /** @param {Field} field
   * @return {Query}
   * */
  where(field) {
    this.filters.push(new Filter(field));
    return this;
  }

  /** @param {string | number} value
   * @return {Query}
   * */
  is(value) {
    this._throwWhenNoFilter("is");

    const lastFilter = this.filters[this.filters.length - 1];
    lastFilter.activate("is", value);

    return this;
  }

  /** @param {string | number} value
   * @return {Query}
   * */
  not(value) {
    this._throwWhenNoFilter("not");

    if (typeof value === "number") value = value.toString();

    const lastFilter = this.filters[this.filters.length - 1];
    lastFilter.activate("not", value);

    return this;
  }

  /** @param {Array<string | number>} values
   * @return {Query}
   * */
  anyof(values) {
    this._throwWhenNoFilter("anyof");

    const newValues /** @type{Array<string>}*/ = values.map((v) => (typeof v === "number" ? v.toString() : v));

    const lastFilter = this.filters[this.filters.length - 1];
    lastFilter.activate("anyof", newValues);

    return this;
  }

  /** @param {Array<string | number>} values
   * @return {Query}
   * */
  noneof(values) {
    this._throwWhenNoFilter("noneof");

    const newValues /** @type{Array<string>}*/ = values.map((v) => (typeof v === "number" ? v.toString() : v));

    const lastFilter = this.filters[this.filters.length - 1];
    lastFilter.activate("noneof", newValues);

    return this;
  }


  /** @param {Field} field
   * @param {string} query
   * @return {Query}
   */
  search(field, query) {
    this._searchField = field;
    this._searchQuery = query;
    return this;
  }

  /** @param {Field} field
   * @param {GroupWith} groupWith
   * @return {Query}
   * */
  groupby(field, groupWith = "name") {
    if (this._isNewGroupByField(field.name)) this.groupBys.push(new GroupBy(field, groupWith));
    else console.warn(`Airtable Query: Field "${field.name}" is already used for grouping. Ignoring duplicate.`);

    return this;
  }

  /** @return {Query} */
  empty() {
    this._throwWhenNoFilter("empty");

    const lastFilter = this.filters[this.filters.length - 1];
    lastFilter.activate("empty", null);

    return this;
  }

  isSearchable(){
     return this._searchField && this._searchQuery.trim() !== "";
  }

  /** @param {Array<Record>} records
   * @return {ApplyResult}
   * */
  apply(records) {
    if (!Array.isArray(records))
      throw new Error(`Airtable Query: apply() expects an array of records, but got "${typeof records}".`);

    // text search — applied before other filters
    const pool = this.isSearchable() ? this._applySearch(records) : records; 

    
    const filtered = pool.filter((record) => {
      const result = this.filters.map((filter) => filter.apply(record));

      if (this.logicalOperator === "AND") return result.every((res) => res === true);
      else return result.some((res) => res === true);
    });

    if (this._hasGroupBys()) return this._groupBy(filtered);
    else return ["array", filtered];
  }

   /** @param {Array<Record>} records
      * @return {Array<Record>}
      */
   _applySearch(records) {
      const field = this._searchField;
      const fuse = new Fuse(records, {
         keys: ["_searchText"],
         getFn: (/** @type {Record} */ r) => r.getCellValueAsString(field),
         threshold: 0.4,
         ignoreLocation: true,
      });

      return fuse.search(this._searchQuery).map((result) => result.item);
   }

  /** @param {Array<Record>} records
   * @return {[ApplyResultType, Object<string, Array<Record>>]}
   */
  _groupBy(records) {
    const groups = /** @type {Object<string, Array<Record>>} */ ({});

    for (const record of records) {
      const perFieldKeys = this.groupBys.map((gb) => {
         const groupWith = gb.groupWith;

        const exploded = airtableUtils.explodeFieldKeys(record.getCellValue(gb.field), groupWith);
        return exploded;
      });

      const combos = airtableUtils.cartesianProduct(perFieldKeys);

      for (const combo of combos) {
        const groupKey = combo.join(" | ");
        (groups[groupKey] = groups[groupKey] || []).push(record);
      }
    }

    return ["group", groups];
  }

  _hasGroupBys() {
    return this.groupBys.length > 0;
  }

  /** @param {string} methodName */
  _throwWhenNoFilter(methodName) {
    if (this.filters.length === 0)
      throw new Error(`Airtable Query: No filter defined. Call where() before ${methodName}().`);
  }

  /** @param {string} fieldName */
  _isNewGroupByField(fieldName) {
    for (const groupBy of this.groupBys) {
      if (groupBy.field.name === fieldName) {
        return false;
      }
    }

    return true;
  }
}
