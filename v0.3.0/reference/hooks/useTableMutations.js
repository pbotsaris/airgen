import * as React from "react";
import { useConfig } from "./useConfig.js";
import { MutableTable } from "../airtable/mutations.js";
import { SCHEMA } from "../config/schemaRegistry.js";

/** @typedef {import("../config/schemaRegistry.js").DealFields} DealFields */
/** @typedef {import("../config/schemaRegistry.js").EstimateFields} EstimateFields */
/** @typedef {import("../config/schemaRegistry.js").StudioFields} StudioFields */
/** @typedef {import("../config/schemaRegistry.js").OrganizationFields} OrganizationFields */
/** @typedef {import("../config/schemaRegistry.js").ScenarioFields} ScenarioFields */
/** @typedef {import("../config/schemaRegistry.js").ServiceItemFields} ServiceItemFields */
/** @typedef {import("../config/schemaRegistry.js").ServiceFields} ServiceFields */
/** @typedef {import("../config/schemaRegistry.js").LicenseTermItemFields} LicenseTermItemFields */
/** @typedef {import("../config/schemaRegistry.js").LicenseTermFields} LicenseTermFields */
/** @typedef {import("../config/schemaRegistry.js").NoteFields} NoteFields */
/** @typedef {import("../config/schemaRegistry.js").NoteItemFields} NoteItemFields */
/** @typedef {import("../config/schemaRegistry.js").NoteTemplateFields} NoteTemplateFields */

/** Inverted groupToTable: table key → field group name */
const tableToGroup = Object.fromEntries(
   Object.entries(SCHEMA.groupToTable).map(([group, tableKey]) => [tableKey, group]),
);

/**
 * Returns a MutableTable instance for the given table key, with typed field keys.
 *
 * @overload
 * @param {"deals"} tableKey
 * @returns {MutableTable<DealFields>|null}
 */
/**
 * @overload
 * @param {"estimates"} tableKey
 * @returns {MutableTable<EstimateFields>|null}
 */
/**
 * @overload
 * @param {"scenarios"} tableKey
 * @returns {MutableTable<ScenarioFields>|null}
 */
/**
 * @overload
 * @param {"serviceItems"} tableKey
 * @returns {MutableTable<ServiceItemFields>|null}
 */
/**
 * @overload
 * @param {"licenseTermItems"} tableKey
 * @returns {MutableTable<LicenseTermItemFields>|null}
 */
/**
 * @overload
 * @param {"services"} tableKey
 * @returns {MutableTable<ServiceFields>|null}
 */
/**
 * @overload
 * @param {"licenseTerms"} tableKey
 * @returns {MutableTable<LicenseTermFields>|null}
 */
/**
 * @overload
 * @param {"notes"} tableKey
 * @returns {MutableTable<NoteFields>|null}
 */
/**
 * @overload
 * @param {"noteItems"} tableKey
 * @returns {MutableTable<NoteItemFields>|null}
 */
/**
 * @overload
 * @param {"noteTemplates"} tableKey
 * @returns {MutableTable<NoteTemplateFields>|null}
 */
/**
 * @overload
 * @param {"studios"} tableKey
 * @returns {MutableTable<StudioFields>|null}
 */
/**
 * @overload
 * @param {"organizations"} tableKey
 * @returns {MutableTable<OrganizationFields>|null}
 */
/**
 * @param {string} tableKey
 * @returns {MutableTable<any>|null}
 */
export function useTableMutations(tableKey) {
   const { config } = useConfig();

   return React.useMemo(() => {
      const table = config.tables[tableKey];
      if (!table) return null;

      const groupName = tableToGroup[tableKey];
      if (!groupName) return null;

      const fields = config.fields[groupName];
      if (!fields) return null;

      return new MutableTable(table, fields);
   }, [config, tableKey]);
}
