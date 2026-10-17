/**
 * @typedef {'tableFields'| 'fieldTypes' | 'both' | 'none'} ValidationErrorType
 */

/**
 * @typedef {Object} ValidationMessageItem
 * @property {string} id
 * @property {string} message
 * @property {Array<string>} [details]
 * @property {"error"|"warning"} [level]
 */

/**
 * @typedef {Object} MissingFieldIssue
 * @property {string} field
 * @property {string} message
 * @property {Array<string>} [possibleNames]
 * @property {string} [table]
 */

/** @typedef {Object} ValidationIssues
 * @property {Object<string, MissingFieldIssue>} [tables]
 * @property {Object<string, Object<string, MissingFieldIssue>>} [tableFields]
 * @property {Object<string, MissingFieldIssue>} [fieldTypes]
 */

/** @exports {ValidationResult}
 * @exports {ValidationIssues} ValidationIssues
 * @exports {ValidationErrorType} ValidationErrorType
 * @exports {ValidationMessageItem} ValidationMessageItem
 * */

/**
 * Encapsulates the presentation logic for validation results.
 *
 * It receives structured ValidationIssues (produced by schema resolver)
 * and exposes:
 *
 * - errorType        → high-level error classification
 * - valid()          → boolean validity check (only tables/tableFields block)
 * - items()          → render-ready message objects (for UI consumption)
 * - reason()         → optional string summary
 *
 * Field type mismatches are warnings — the field was found but has unexpected type.
 */
export class ValidationResult {
   /** @param {ValidationIssues} issues */
   constructor(issues = {}) {
      this.issues = issues;
   }

   /** @returns {ValidationErrorType} */
   get errorType() {
      const hasTables =
         !!this.issues.tables && Object.keys(this.issues.tables).length > 0;
      const hasFields =
         !!this.issues.tableFields && Object.values(this.issues.tableFields).some((t) => t && Object.keys(t).length > 0);
      const hasTypes =
         !!this.issues.fieldTypes && Object.keys(this.issues.fieldTypes).length > 0;

      if (!hasTables && !hasFields && !hasTypes) return "none";
      if ((hasTables || hasFields) && hasTypes) return "both";
      if (hasTables || hasFields) return "tableFields";
      return "fieldTypes";
   }

   /** Validity check — only missing tables/required fields block rendering. Type mismatches are warnings. */
   valid() {
      const hasTables = !!this.issues.tables && Object.keys(this.issues.tables).length > 0;
      const hasFields =
         !!this.issues.tableFields && Object.values(this.issues.tableFields).some((t) => t && Object.keys(t).length > 0);
      return !hasTables && !hasFields;
   }

   /** @returns {Array<ValidationMessageItem>} */
   items() {
      /** @type {Array<ValidationMessageItem>} */
      const out = [];

      if (this.issues.tables) {
         for (const [key, issue] of Object.entries(this.issues.tables)) {
            out.push({
               id: `tables:${key}`,
               level: "error",
               message: issue.message,
               details: issue.possibleNames?.length ? [`Tried: ${issue.possibleNames.join(", ")}`] : undefined,
            });
         }
      }

      if (this.issues.tableFields) {
         for (const [tableName, missing] of Object.entries(this.issues.tableFields)) {
            for (const [field, issue] of Object.entries(missing || {})) {
               out.push({
                  id: `tableFields:${tableName}:${field}`,
                  level: "error",
                  message: issue.message,
                  details: issue.possibleNames?.length ? [`Tried: ${issue.possibleNames.join(", ")}`] : undefined,
               });
            }
         }
      }

      if (this.issues.fieldTypes) {
         for (const [key, issue] of Object.entries(this.issues.fieldTypes)) {
            out.push({
               id: `fieldTypes:${key}`,
               level: "warning",
               message: issue.message,
            });
         }
      }

      return out;
   }

   reason() {
      if (this.valid() && !this.issues.fieldTypes) return "";
      return this.items()
         .map((i) => i.message + (i.details?.length ? ` (${i.details.join(" | ")})` : ""))
         .join("\n");
   }

   toJSON() {
      return JSON.stringify({ errorType: this.errorType, issues: this.issues });
   }
}
