import { Field, FieldType } from "@airtable/blocks/interface/models";
import { colorUtils } from "@airtable/blocks/interface/ui";

import "./airtableTypes.js";
import "../components/commonTypes.js";
import { choiceToSelectOption, choicesToSelectOptions } from "../components/recordOptions.js";

/**
 * Null-safe inspection of a `Field`: its choices, their colors, and value conversion.
 * A null field (one schema inference never resolved) is valid input everywhere — the
 * inspector simply reports no choices rather than throwing.
 *
 * A MULTIPLE_LOOKUP_VALUES field inspects as the field it looks up, so a lookup of a
 * single select behaves like that single select throughout.
 *
 * `FieldInspector.for(field)` is the entry point: `FieldInspector.for(field).getColor(value)`.
 * It builds a fresh inspector — re-checking the choices and rebuilding the name → color map —
 * so to resolve many values against one field (one per row, say), hold the instance instead:
 * `const inspector = FieldInspector.for(field)`.
 */

export class FieldInspector {
   /** @param {Field|null} field */
   constructor(field) {
      /** @type {Field|null} */
      this.field = field;

      /** @type {FieldType|null} */
      this.type = field ? field.type : null;

      // A lookup field describes the *link* in its own options; the field it looks up is
      // nested under `options.result` ({type, options}). So a lookup of a single select
      // keeps its choices at `options.result.options.choices`, not `options.choices`.
      // We unwrap the lookup field to get the actual type and options of the field it looks up.
      const lookupResult = this._unwrapLookupField(field, this.type);

      /** @type {FieldType|null} - the type whose value this field actually holds (unwraps lookups) */
      this.resultType = lookupResult ? (lookupResult.type ?? null) : this.type;

      /** @type {any} - the options carrying the choices (unwraps lookups) */
      this.options = lookupResult ? (lookupResult.options ?? null) : (field?.options ?? null);

      /** @type {boolean} */
      this.hasOptions = !!this.options;

      /** @type {SingleSelectValue[]} */
      this.choices = this.hasChoices() ? this._typeCheckSingleSelectValue(this.options.choices) : [];

      this.colorByType = new Map(
         /** @type {[string, string][]} */(
            this.hasChoices()
               ? this.getChoices().map((/** @type {SingleSelectValue} */ c) => [
                  c.name.toLowerCase(),
                  colorUtils.getHexForColor(c.color),
               ])
               : []
         ),
      );
   }

   /**
    * Create a FieldInspector for `field`, without `new`. This is the entry point — every
    * inspection reads as `FieldInspector.for(field).action(value)`.
    *
    * Example:
    * - `FieldInspector.for(field).getColor(value)`.
    * - `FieldInspector.for(field).getChoices()`.
    * - `FieldInspector.for(field).toComponentOptions()`.
    * - `FieldInspector.for(field).convertTo(value, target)`.
    * - `FieldInspector.for(field).getChoiceByName(name)`.
    *
    * Builds a fresh inspector, and with it a fresh choice → color map, on every call. To resolve
    * many values against the same field (one per row, say), hold the instance instead:
    * `const inspector = FieldInspector.for(field)`, then `inspector.getColor(value)`.
    *
    * @static
    * @param {Field|null} field
    * @returns {FieldInspector}
    * */
   static for(field) {
      return new FieldInspector(field);
   }

   /**
    * Hex color for one choice of this field.
    *
    * Works for SINGLE_SELECT and MULTIPLE_SELECTS fields, and for a MULTIPLE_LOOKUP_VALUES
    * field looking either of those up. Any other field type resolves to null.
    *
    * Takes either the choice name or the choice object — a single-select cell (and the
    * unwrapped value of a lookup of one) reads as `{id, name, color}`, which already carries
    * its color and so resolves without consulting the choices at all.
    *
    * One choice, not a cell: a MULTIPLE_SELECTS cell is an array of choices, and passing that
    * array resolves to null. Map over it instead, or use getMultiColor.
    *
    * @param {string | {name?: string, color?: string} | null} fieldValue
    * @returns {string | null}
    */
   getColor(fieldValue) {
      if (!fieldValue) return null;

      /** @type {string | null} */
      let name = null;

      if (typeof fieldValue === "object") {
         if (fieldValue.color) return colorUtils.getHexForColor(fieldValue.color);
         name = fieldValue.name ?? null;
      } else {
         name = fieldValue;
      }

      if (!name) return null;

      if (!this.hasChoices()) {
         this._warnColor();
         return null;
      }

      const color = this.colorByType.get(name.toLowerCase());

      if (!color) {
         console.warn(
            `FieldInspector: No color found for field value '${name}'. Available choices: ${JSON.stringify(
               this.choices.map((c) => c.name),
            )}`,
         );
         return null;
      }

      return color;
   }

   /**
    * Hex colors for a whole MULTIPLE_SELECTS cell — the plural of getColor.
    *
    * A multi-select cell reads as an array of `{id, name, color}` choices, which getColor
    * rejects because it resolves one choice at a time. This takes the array whole. Names work
    * in place of choice objects, and a lone value is treated as an array of one.
    *
    * Choices that resolve to no color are dropped, so the result can be shorter than the input
    * and is not index-aligned with it.
    *
    * @param {any} cellValue
    * @returns {string[]}
    */
   getMultiColor(cellValue) {
      if (!cellValue) return [];

      const values = Array.isArray(cellValue) ? cellValue : [cellValue];

      // a lookup of a multi-select nests an array per linked record, so flatten one level
      return values
         .flat()
         .map((value) => this.getColor(value))
         .filter((color) => color !== null);
   }

   /**
    * Every choice of this field, or [] when it has none.
    *
    * @returns {SingleSelectValue[]}
    */
   getChoices() {
      if (!this.hasChoices()) this._warn();

      return this.choices;
   }

   /**
    * The choices of this field as options for the Select component. [] when it has none.
    *
    * Converts through `choiceToSelectOption` like every other choice → option crossing,
    * so the options are built in exactly one place. `this.choices` is already filtered to
    * well-formed `{id, name, color}` by `_typeCheckSingleSelectValue`, so nothing is dropped.
    *
    * @returns {ComponentSelectOption[] }
    */
   toComponentOptions() {
      if (!this.hasChoices()) {
         this._warn();
         return [];
      }

      return choicesToSelectOptions(this.choices);
   }

   /**
    * The choice of this field with this name, matched case-insensitively. Null when absent.
    *
    * @param {string} name
    * @returns {SingleSelectValue | null}
    */
   getChoiceByName(name) {
      if (!this.hasChoices()) {
         this._warn();
         return null;
      }

      if (this.choices.length === 0) return null;

      return this.choices.find((choice) => choice.name.toLowerCase() === name.toLowerCase()) || null;
   }

   /**
    * The choice of this field with this id. Null when absent.
    *
    * @param {string} id
    * @returns {SingleSelectValue | null}
    */
   getChoiceById(id) {
      if (!this.hasChoices()) {
         this._warn();
         return null;
      }

      if (this.choices.length === 0) return null;

      return this.choices.find((choice) => choice.id === id) || null;
   }

   /**
    * Convert `value` into the shape this field expects — an Airtable cell value by default, or a
    * Select component option with `target: 'selectComponent'`.
    *
    * Writing is what this is for, so do not call it on a MULTIPLE_LOOKUP_VALUES field: lookups
    * are read-only, and the value it hands back could not be written back anyway.
    *
    * A value the field needs no conversion for — text, numbers, checkboxes — passes through
    * untouched, so this is safe to call for any field. But it is not idempotent: it expects a
    * raw choice id/name or record id, never an already-converted value. Handing it a link array
    * nests it again, and handing it a choice object resolves to null, which clears the field.
    *
    * @param {any} value
    * @param {'selectComponent' | 'airtable'} [target='airtable']
    * @returns {any}
    * */
   convertTo(value, target = "airtable") {
      if (this.hasChoices()) {
         const result = this._convertValueForSelectComponentWithOptions(value);
         if (target === "selectComponent") return result;

         return this._selectComponentValueToAirtableSelectValue(result);
      }

      if (this.type === FieldType.MULTIPLE_RECORD_LINKS) {
         if (Array.isArray(value)) return value.map((val) => ({ id: val }));
         else return [{ id: value }];
      }

      if (target === "airtable" && this.resultType === FieldType.PERCENT) return this._toPercentFraction(value);

      return value;
   }

   /**
    * An Airtable cell value → the shape the UI works in. The inverse of convertTo, and the read
    * half of the same contract: a percent cell holds a fraction (0.1 is 10%), and every screen
    * works in whole percents, so this is where the two meet.
    *
    * Anything the UI can consume as-is passes through untouched.
    *
    * @param {any} value
    * @returns {any}
    */
   convertFrom(value) {
      if (this.resultType === FieldType.PERCENT) return this._toWholePercent(value);

      return value;
   }

   /** 10 → 0.1. Not every base types its percent columns as PERCENT — a plain number field
    * already holds whole percents, so it must pass through untouched.
    * @param {any} value */
   _toPercentFraction(value) {
      if (!this._isWritableNumber(value)) return value;

      return value / 100;
   }

   /** 0.1 → 10. See _toPercentFraction.
    * @param {any} value */
   _toWholePercent(value) {
      if (!this._isWritableNumber(value)) return value;

      return value * 100;
   }

   /** Guards the percent maths. Note this is deliberately *not* a float check: 0%, 100% and 200%
    * store as 0, 1 and 2, so integer-ness says nothing about whether a value is already converted.
    * What it rules out is a string or null dividing into NaN and overwriting the cell.
    * @param {any} value */
   _isWritableNumber(value) {
      if (typeof value === "number" && Number.isFinite(value)) return true;

      console.warn(
         `FieldInspector: Field '${this.field?.name}' is a '${this.resultType}', which converts numerically, ` +
         `but the value is ${JSON.stringify(value)} (${typeof value}). Leaving it as-is.`,
      );

      return false;
   }

   hasChoices() {
      // `this.options` is the unwrapped options — for a lookup, the looked-up field's
      return this.hasOptions && Array.isArray(this.options?.choices);
   }

   _selectComponentValueToAirtableSelectValue(options) {
      if (!options) return null;

      if (!Array.isArray(options) && typeof options === "object") {
         return { id: options.value, name: options.label, color: options.color };
      }

      if (Array.isArray(options)) return options.map((o) => ({ id: o.value, name: o.label, color: o.color }));

      return options;
   }

   /** @param {string | string[]} value */
   _findChoiceByIdOrName(value) {
      if (typeof value !== "string") {
         console.warn("FieldInspector: Expected a string for single select field value but found:", value);
         return null;
      }

      const choiceById = this.getChoiceById(value);

      const choiceByName = this.getChoiceByName(value);
      if (!choiceById && !choiceByName)
         console.warn(
            `FieldInspector: No choice found for single select choices ${JSON.stringify(this.choices)} field value:`,
            value,
         );

      return choiceById || choiceByName ? choiceToSelectOption(choiceById || choiceByName) : null;
   }

   /** @param {string | string[]} value */
   _convertValueForSelectComponentWithOptions(value) {
      if (this.resultType === FieldType.SINGLE_SELECT || this.resultType === FieldType.SINGLE_COLLABORATOR)
         return this._findChoiceByIdOrName(value);

      if (this.resultType === FieldType.MULTIPLE_SELECTS || this.resultType === FieldType.MULTIPLE_COLLABORATORS) {
         if (!Array.isArray(value)) {
            console.warn("FieldInspector: Expected an array for multiple select field value but found:", value);
            return [];
         }

         return value.map((val) => this._findChoiceByIdOrName(val)).filter((option) => option !== null);
      }
   }

   /** @param {unknown} values */
   _findMultipleChoicesByIdOrName(values) {
      if (!Array.isArray(values)) {
         console.warn("FieldInspector: Expected an array for multiple select field value but found:", values);
         return [];
      }

      return values
         .map((val) => {
            return this._findChoiceByIdOrName(val);
         })
         .filter((option) => option !== null);
   }

   /** @param {unknown} choices
    * @returns {SingleSelectValue[]}
    **/
   _typeCheckSingleSelectValue(choices) {
      if (!Array.isArray(choices)) {
         console.error("Choices is not an array:", choices);
         return [];
      }

      const filteredChoices = choices.filter((choice) => {
         const valid =
            typeof choice === "object" &&
            Object.keys(choice).length === 3 &&
            "id" in choice &&
            "name" in choice &&
            "color" in choice &&
            typeof choice.id === "string" &&
            typeof choice.name === "string" &&
            typeof choice.color === "string";

         if (!valid) {
            console.error("Invalid SingleSelectValue object:", choice);
         }

         return valid;
      });

      return /** @type {SingleSelectValue[]}*/ (filteredChoices);
   }

   /** @param {Field|null} field
    * @param {FieldType|null} type
    * @returns {any|null}
    * */
   _unwrapLookupField(field, type) {
      return type === FieldType.MULTIPLE_LOOKUP_VALUES ? /** @type {any} */ (field?.options?.result) : null;
   }

   _warn() {
      if (!this.field) {
         console.warn("FieldInspector: Field is null — it was not resolved by schema inference or config table.");
         return;
      }
      console.warn(
         `FieldInspector: Field has no choices. Do you have the correct field type '${this.field.type}' for '${this.field.name}'?`,
      );
   }

   _warnColor() {
      if (!this.field) {
         console.warn(
            "FieldInspector: Field is null — it was not resolved by schema inference or config table. Cannot get color for field value.",
         );
         return;
      }

      // for a lookup, `type` is always multipleLookupValues — the type that decides whether
      // colors exist is the one it looks up, so report that instead of leaving it a mystery
      const isLookup = this.type === FieldType.MULTIPLE_LOOKUP_VALUES;
      const describeType = isLookup ? `'${this.type}' looking up a '${this.resultType}'` : `'${this.type}'`;

      console.warn(
         `FieldInspector: Field '${this.field.name}' has no choices, so it has no colors. ` +
         `Only '${FieldType.SINGLE_SELECT}' and '${FieldType.MULTIPLE_SELECTS}' fields carry choice colors — ` +
         `as does a '${FieldType.MULTIPLE_LOOKUP_VALUES}' field that looks one of them up. ` +
         `This field is ${describeType}.`,
      );
   }
}
