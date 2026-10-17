import { useRecords } from "@airtable/blocks/interface/ui";
import { Table } from "@airtable/blocks/interface/models";
import { SCHEMA } from "../config/schemaRegistry.js";

const KEY_ALIASES = ["key", "code", "fieldKey", "field key", "chave"];
const VALUE_ALIASES = ["value", "field", "fieldname", "field name", "coluna", "column name"];
const TABLE_ALIASES = ["table", "tabela", "group", "grupo"];

/**
 * Reads an optional config table into a flat key→value object.
 *
 * Supports two formats:
 * - **2-column**: key ("deal.stage") + value ("My Field")
 * - **3-column**: table ("Deals") + key ("stage") + value ("My Field")
 *
 * In 3-column mode the table name is normalized to a group name
 * (lowercase, depluralized, camelCased) and combined as "group.key".
 *
 * @param {Table|null} configTable
 * @returns {Object<string, string>}
 */
export function useConfigTable(configTable) {
   const records = useRecords(configTable);

   if (!configTable || !records || records.length === 0) return {};

   const keyField = findFieldByAliases(configTable, KEY_ALIASES);
   const valueField = findFieldByAliases(configTable, VALUE_ALIASES);
   const tableField = findFieldByAliases(configTable, TABLE_ALIASES);

   if (!keyField || !valueField) {
      const columns = configTable.fields.map((f) => f.name).join(", ");
      console.warn(`[Config] Table "${configTable.name}" is missing required columns. Expected: key/chave + value/field. Found columns: ${columns}`);
      return {};
   }

   const groupLookup = buildGroupLookup();

   /** @type {Object<string, string>} */
   const overrides = {};

   for (const record of records) {
      const rawKey = record.getCellValueAsString(keyField).trim();
      const value = record.getCellValueAsString(valueField).trim();
      if (!rawKey) continue;

      let overrideKey;

      if (tableField) {
         // 3-column format: table + key → "group.key"
         const rawTable = record.getCellValueAsString(tableField).trim();
         if (!rawTable) continue;
         const group = groupLookup.get(normalizeTableName(rawTable));
         if (!group) {
            const knownGroups = [...new Set(groupLookup.values())].join(", ");
            console.warn(`[Config] Row skipped — table "${rawTable}" doesn't match any field group. Known groups: ${knownGroups}`);
            continue;
         }
         overrideKey = `${group}.${rawKey}`;
      } else {
         overrideKey = rawKey;
      }

      overrides[overrideKey] = value;
   }

   return overrides;
}

/**
 * Builds a lookup from normalized table name/alias → group name.
 * e.g. "deal" → "deal", "deals" → "deal", "negócios" → "deal", "scenarios" → "scenario"
 * @returns {Map<string, string>}
 */
export function buildGroupLookup() {
   /** @type {Map<string, string>} */
   const lookup = new Map();

   // Invert groupToTable: { deal: "deals" } → deals → deal
   const tableKeyToGroup = new Map();
   for (const [group, tableKey] of Object.entries(SCHEMA.groupToTable)) {
      tableKeyToGroup.set(tableKey, group);
      // Also map the group name itself
      lookup.set(normalizeTableName(group), group);
   }

   // Map every table alias to its group name
   for (const tableSchema of Object.values(SCHEMA.tables)) {
      const group = tableKeyToGroup.get(tableSchema.key);
      if (!group) continue;

      lookup.set(normalizeTableName(tableSchema.key), group); // "deals" → "deal"
      for (const alias of tableSchema.aliases) {
         lookup.set(normalizeTableName(alias), group);
      }
   }

   return lookup;
}

/**
 * Normalizes a table name for group lookup:
 * "License Terms" → "licenseterm", "Deals" → "deal", "Scenarios" → "scenario"
 * @param {string} name
 * @returns {string}
 */
export function normalizeTableName(name) {
   let s = name.trim().toLowerCase();
   if (s.endsWith("s") && !s.endsWith("ss")) s = s.slice(0, -1);
   s = s.replace(/\s+/g, "");
   return s;
}

/**
 * @param {Table} table
 * @param {string[]} aliases
 */
function findFieldByAliases(table, aliases) {
   const wanted = new Set(aliases.map((a) => a.toLowerCase()));
   for (const field of table.fields) {
      if (wanted.has(field.name.toLowerCase().trim())) return field;
   }
   return null;
}
