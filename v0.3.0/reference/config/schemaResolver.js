import { Field, Table, Base } from "@airtable/blocks/interface/models";

/**
 * @typedef {Object} MissingFieldIssue
 * @property {string} field
 * @property {string} message
 * @property {string[]} [possibleNames]
 * @property {string} [table]
 */

/**
 * @typedef {Object} ValidationIssues
 * @property {Object<string, MissingFieldIssue>} [tables]
 * @property {Object<string, Object<string, MissingFieldIssue>>} [tableFields]
 * @property {Object<string, MissingFieldIssue>} [fieldTypes]
 */

/** @typedef {import("./schemaRegistry.js").SchemaTables} SchemaTables */
/** @typedef {import("./schemaRegistry.js").ResolvedFields} ResolvedFields */
/** @typedef {import("./schemaRegistry.js").FieldDef} FieldDef */

/**
 * Unified schema resolver.
 *
 * Resolution per field:
 * 1. Check configTableOverrides["group.fieldKey"] → find field by that name
 * 2. Otherwise, match field name against aliases (case-insensitive)
 * 3. Otherwise, if the def is flagged `primary`, use the table's primary field
 * 4. Validate resolved field's type against allowed types
 *
 * @param {Object} params
 * @param {Base} params.base
 * @param {Object} params.schema
 * @param {Object<string, string>} [params.configTableOverrides]
 * @returns {{ tables: SchemaTables, fields: ResolvedFields, issues: ValidationIssues }}
 */
export function resolveSchema({ base, schema, configTableOverrides = {} }) {
   /** @type {ValidationIssues} */
   const issues = {};

   /** @type {Object<string, Table|null>} */
   const tables = {};

   /** @type {Object<string, Object<string, Field|null>>} */
   const fields = {};

   // Resolve tables
   for (const tableSchema of Object.values(schema.tables || {})) {
      tables[tableSchema.key] = resolveTable(base, tableSchema, issues);
   }

   // Resolve fields for each field group
   const knownKeys = new Set();
   for (const [group, fieldDefs] of Object.entries(schema.fields || {})) {
      const tableKey = schema.groupToTable[group];
      const table = tableKey ? tables[tableKey] : null;
      fields[group] = resolveFieldGroup(group, table, fieldDefs, configTableOverrides, issues);
      for (const fieldKey of Object.keys(fieldDefs)) knownKeys.add(`${group}.${fieldKey}`);
   }

   // Warn about unrecognized config table keys
   for (const key of Object.keys(configTableOverrides)) {
      if (!knownKeys.has(key)) {
         console.warn(`[Config] Unrecognized override key "${key}". Valid keys: ${[...knownKeys].sort().join(", ")}`);
      }
   }

   return {
      tables: /** @type {SchemaTables} */ (tables),
      fields: /** @type {ResolvedFields} */ (fields),
      issues,
   };
}

// --- Table resolution ---

/**
 * @param {Base} base
 * @param {Object} tableSchema
 * @param {ValidationIssues} issues
 * @returns {Table|null}
 */
function resolveTable(base, tableSchema, issues) {
   const { key, aliases } = tableSchema;

   // Config table is optional — don't emit an issue if missing
   if (key === "config") {
      return findTableByAliases(base.tables, aliases);
   }

   // Try alias-based resolution
   const found = findTableByAliases(base.tables, aliases);
   if (found) return found;

   issues.tables = issues.tables || {};
   issues.tables[key] = {
      field: key,
      message: `Table "${key}" not found. Tried names: ${normalizeAliases(aliases).join(", ")}.`,
      possibleNames: normalizeAliases(aliases),
   };


   return null;
}

// --- Field resolution ---

/**
 * @param {string} group
 * @param {Table|null} table
 * @param {Object<string, FieldDef>} fieldDefs
 * @param {Object<string, string>} configTableOverrides
 * @param {ValidationIssues} issues
 * @returns {Object<string, Field|null>}
 */
function resolveFieldGroup(group, table, fieldDefs, configTableOverrides, issues) {
   /** @type {Object<string, Field|null>} */
   const resolved = {};

   for (const [fieldKey, def] of Object.entries(fieldDefs)) {
      resolved[fieldKey] = resolveField(group, fieldKey, table, def, configTableOverrides, issues);
   }

   return resolved;
}

/**
 * @param {string} group
 * @param {string} fieldKey
 * @param {Table|null} table
 * @param {FieldDef} def
 * @param {Object<string, string>} configTableOverrides
 * @param {ValidationIssues} issues
 * @returns {Field|null}
 */
function resolveField(group, fieldKey, table, def, configTableOverrides, issues) {

   if (!table) return null;
   

   // 1. Config table override: "deal.stage" → field name
   const overrideKey = `${group}.${fieldKey}`;
   const overrideName = configTableOverrides[overrideKey];

   if (overrideName) {
      const field = findFieldByExactName(table, overrideName);
      if (field) {
         validateFieldType(group, fieldKey, field, def, issues);
         return field;
      }
      // Override name didn't match a column. Don't warn yet — a stale but harmless
      // override row still resolves via aliases below. Only warn (further down) if the
      // field ultimately fails to resolve, so a redundant override doesn't spam the console.
   }

   // 2. Alias-based resolution
   const aliases = (def.aliases || []).map(normalizeString);
   const field = findFieldByPossibleNames(table, aliases);

   if (field) {
      validateFieldType(group, fieldKey, field, def, issues);
      return field;
   }

   // 3. Primary-field fallback: a def flagged `primary` accepts the table's primary
   //    field under any name (e.g. "License Term" as the name of a License Terms row).
   if (def.primary && table.primaryField) {
      validateFieldType(group, fieldKey, table.primaryField, def, issues);
      return table.primaryField;
   }

   // 4. Not found. If an override name was given but neither it nor the aliases resolved,
   //    surface the bad override — this is the one case where it's actionable.
   if (overrideName) {
      const available = table.fields.map((f) => f.name).join(", ");
      console.warn(`[Config] Override "${overrideKey}" → "${overrideName}" not found in table "${table.name}". Available fields: ${available}.`);
   }

   if (def.required) {
      issues.tableFields = issues.tableFields || {};
      issues.tableFields[group] = issues.tableFields[group] || {};
      issues.tableFields[group][fieldKey] = {
         field: fieldKey,
         table: table.name,
         possibleNames: aliases,
         message: `Table "${table.name}" is missing required field "${fieldKey}". Tried: ${aliases.join(", ")}.`,
      };
   }

   return null;
}

/**
 * @param {string} group
 * @param {string} fieldKey
 * @param {Field} field
 * @param {FieldDef} def
 * @param {ValidationIssues} issues
 */
function validateFieldType(group, fieldKey, field, def, issues) {
   const allowedTypes = def.types;
   if (!allowedTypes || allowedTypes.length === 0) return;

   if (!allowedTypes.includes(field.type)) {
      issues.fieldTypes = issues.fieldTypes || {};
      issues.fieldTypes[`${group}.${fieldKey}`] = {
         field: fieldKey,
         table: group,
         message: `Field "${field.name}" (${group}.${fieldKey}) has type "${field.type}" but expected one of: ${allowedTypes.join(", ")}.`,
      };
   }
}

// --- Helpers ---

function normalizeString(s) {
   return String(s ?? "")
      .toLowerCase()
      .replace(/\s*:\s*/g, ": ") // normalize spacing around colons ("term :  override" → "term: override")
      .replace(/\s+/g, " ") // collapse internal whitespace runs
      .trim();
}

function normalizeAliases(aliases) {
   return Array.from(new Set((aliases || []).map(normalizeString).filter(Boolean)));
}

function tokenizeTableName(name) {
   return normalizeString(name).split(/\s+/).filter(Boolean);
}

/**
 * @param {Table[]} tables
 * @param {string[]} aliases
 * @returns {Table|null}
 */
function findTableByAliases(tables, aliases) {
   const wanted = new Set(normalizeAliases(aliases));

   // Exact full-name matches win over token matches across the whole base, in that order —
   // otherwise "License Term Items" (tokens: license, term, items) can capture the aliases of
   // "License Terms" or "Scenario Service Items" just by appearing earlier in the base.
   for (const table of tables || []) {
      if (wanted.has(normalizeString(table.name))) return table;
   }

   for (const table of tables || []) {
      const tokens = tokenizeTableName(table.name);
      for (const t of tokens) {
         if (wanted.has(t)) return table;
      }
   }

   return null;
}

/**
 * @param {Table} table
 * @param {string[]} possibleNames
 * @returns {Field|null}
 */
function findFieldByPossibleNames(table, possibleNames) {
   const index = new Map(table.fields.map((f) => [normalizeString(f.name), f]));

   for (const n of possibleNames || []) {
      const field = index.get(normalizeString(n));
      if (field) return field;
   }

   return null;
}

/**
 * @param {Table} table
 * @param {string} name
 * @returns {Field|null}
 */
function findFieldByExactName(table, name) {
   const normalized = normalizeString(name);
   for (const field of table.fields) {
      if (normalizeString(field.name) === normalized) return field;
   }
   return null;
}

export { findTableByAliases };
