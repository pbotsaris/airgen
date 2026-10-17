import { Base } from "@airtable/blocks/interface/models";
import { ValidationResult } from "./ValidationResult.js";
import { resolveSchema } from "./schemaResolver.js";
import { SCHEMA } from "./schemaRegistry.js";

/** @typedef {import("./schemaRegistry.js").SchemaTables} SchemaTables */
/** @typedef {import("./schemaRegistry.js").ResolvedFields} ResolvedFields */
/**
 * @typedef {Object} ResolvedConfig
 * @property {SchemaTables} tables
 * @property {ResolvedFields} fields
 * @property {Object} custoProps
 */

/**
 * Single-path configuration resolution.
 *
 * @param {Base} base
 * @param {Object} custoProps
 * @param {Object<string, string>} [configTableOverrides]
 * @returns {{ config: ResolvedConfig, validation: ValidationResult }}
 */
export function resolveConfig(base, custoProps, configTableOverrides = {}) {

   const { tables, fields, issues } = resolveSchema({
      base,
      schema: SCHEMA,
      configTableOverrides,
   });

   /** @type {ResolvedConfig} */
   const config = {
      custoProps,
      tables,
      fields,
   };

   return {
      config,
      validation: new ValidationResult(issues),
   };
}
