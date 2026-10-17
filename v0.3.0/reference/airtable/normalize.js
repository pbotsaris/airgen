import utils from "../utils/utils";

const normalize = {};
import "../airtable/airtableTypes.js";

/** @param {any} linkRecordInfo
 * @returns {OwnerValue | null} */
normalize.getUserRecord = (linkRecordInfo) => {
   if (!linkRecordInfo) return null;

   if (typeof linkRecordInfo === "object") return getUserRecordWhenObject(linkRecordInfo);

   throw new Error(
      `getUserRecord: the 'linkRecordInfo' ${utils.inspect(linkRecordInfo)}
         is of an unexpected type of ${typeof linkRecordInfo}. Expects an object with id, name and email properties.`,
   );
};

/** @param {any} linkRecordInfo
 * @returns {LinkedRecordValue | null} */
normalize.getLinkRecord = (linkRecordInfo) => {
   if (!linkRecordInfo) return null;

   if (Array.isArray(linkRecordInfo) && linkRecordInfo.length === 0) {
      console.warn("linkRecordInfo: Called with an empty array studioId:  ", utils.inpect(linkRecordInfo));
      console.warn("LinkRecordInfo: Make sure you estimate has a studio assigned to the deal.");
      return null;
   }

   if (Array.isArray(linkRecordInfo) && linkRecordInfo.length > 0) {
      const value = linkRecordInfo[0];
      return getLinkRecordInfoWhenObject(value);
   }

   if (typeof linkRecordInfo === "object") return getLinkRecordInfoWhenObject(linkRecordInfo);

   throw new Error(
      `getLinkRecord: the 'linkRecordInfo' ${utils.inspect(linkRecordInfo)} is of an unexpected type of ${typeof linkRecordInfo}. Expects and array of objects with id and name properties.`,
   );
};

/** @param {any} linkRecordInfo
 * @returns {string | null} */
normalize.getLinkRecordId = (linkRecordInfo) => {
   const res = normalize.getLinkRecord(linkRecordInfo);

   if (res) return res.id;
   else return null;
};

/** @param {any} linkRecordInfos
 * @returns {LinkedRecordValue[]}
 * */
normalize.listLinkRecords = (linkRecordInfos) => {
   if (!linkRecordInfos) return [];

   if (!Array.isArray(linkRecordInfos)) {
      throw new Error(
         `listLinkRecordIds: 'linkRecordInfos' is null, undefined or not an array. Found: ${utils.inspect(linkRecordInfos)}`,
      );
   }

   const ids = [];

   for (const linkRecordInfo of linkRecordInfos) {
      if (typeof linkRecordInfo !== "object") {
         throw new Error(
            `listLinkRecordIds: each 'linkRecordInfo' is expected to be an object. Found: ${utils.inspect(linkRecordInfo)}`,
         );
      }

      ids.push(getLinkRecordInfoWhenObject(linkRecordInfo));
   }

   return ids;
};

/**
 * Only the ids are read, so a link without a `name` is fine here — Airtable briefly reports
 * `[{id}]` after a write, until the server echoes the full value back.
 *
 * @param {any} linkRecordInfos
 * @returns {Array<string>}
 * */
normalize.listLinkRecordIds = (linkRecordInfos) => {
   if (!linkRecordInfos) return [];

   if (!Array.isArray(linkRecordInfos)) {
      throw new Error(
         `listLinkRecordIds: 'linkRecordInfos' is null, undefined or not an array. Found: ${utils.inspect(linkRecordInfos)}`,
      );
   }

   return linkRecordInfos.map((linkRecordInfo) => {
      const maybeValue =
         linkRecordInfo && typeof linkRecordInfo === "object" && "value" in linkRecordInfo
            ? linkRecordInfo.value
            : linkRecordInfo;

      if (!maybeValue || typeof maybeValue !== "object" || typeof maybeValue.id !== "string") {
         throw new Error(
            `listLinkRecordIds: each 'linkRecordInfo' is expected to be an object with an 'id'. Found: ${utils.inspect(linkRecordInfo)}`,
         );
      }

      return maybeValue.id;
   });
};

/** @param {any} singleSelectInfo
 * @returns {SingleSelectValue | null}
 * */
normalize.getSingleSelectValue = (singleSelectInfo) => {
   if (!singleSelectInfo) return null;

   if (typeof singleSelectInfo !== "object") {
      throw new Error(
         `getSingleSelectValue: the 'singleSelectInfo' ${utils.inspect(singleSelectInfo)} is expected to be an object but found ${typeof singleSelectInfo}.`,
      );
   }

   const isValid = "name" in singleSelectInfo && "color" in singleSelectInfo && "id" in singleSelectInfo;

   if (!isValid) {
      throw new Error(
         `getSingleSelectValue: the 'singleSelectInfo' ${utils.inspect(singleSelectInfo)} is expected to have 'name' and 'color' properties but found ${Object.keys(singleSelectInfo).join(", ")}.`,
      );
   }

   return {
      name: singleSelectInfo.name,
      color: singleSelectInfo.color,
      id: singleSelectInfo.id,
   };
};

/** @param {Array} singleSelectInfos
 * @return {SingleSelectValue[]}
 **/
normalize.listMultiSelectValues = (singleSelectInfos) => {
   if (!singleSelectInfos) return [];

   const values = [];

   if (!Array.isArray(singleSelectInfos)) {
      throw new Error(
         `listSingleSelectValues: 'singleSelectInfos' is null, undefined or not an array. Found: ${utils.inspect(singleSelectInfos)}`,
      );
   }

   for (const singleSelectInfo of singleSelectInfos) {
      const value = normalize.getSingleSelectValue(singleSelectInfo);
      if (value) values.push(value);
   }

   return values;
};

/**
 * Unwrap a MULTIPLE_LOOKUP_VALUES cell.
 *
 * Airtable reads a lookup as `Array<{linkedRecordId, value}>`, where `value` is the cell
 * value of the field being looked up — so its shape follows *that* field's type, not the
 * lookup's. A lookup of a single select yields `{id, name, color}` values, which is why
 * getCellValueAsString is not enough when the color is what you're after.
 *
 * @param {any} lookupInfo
 * @returns {Array<any>} the unwrapped values, in linked-record order
 */
normalize.listLookupValues = (lookupInfo) => {
   if (!lookupInfo) return [];

   if (!Array.isArray(lookupInfo)) {
      throw new Error(
         `listLookupValues: 'lookupInfo' is expected to be an array of {linkedRecordId, value}. Found: ${utils.inspect(lookupInfo)}`,
      );
   }

   return lookupInfo
      .map((entry) => (entry && typeof entry === "object" && "value" in entry ? entry.value : entry))
      .filter((value) => value !== null && value !== undefined);
};

/**
 * First value of a MULTIPLE_LOOKUP_VALUES cell, or null when empty.
 * A lookup through a single linked record still reads as an array of one.
 *
 * @param {any} lookupInfo
 * @returns {any}
 */
normalize.getLookupValue = (lookupInfo) => {
   const [first] = normalize.listLookupValues(lookupInfo);
   return first ?? null;
};

/** @param {Object} studioLinkInfo
 *  @returns {LinkedRecordValue}*/
function getLinkRecordInfoWhenObject(studioLinkInfo) {
   const maybeValue = "value" in studioLinkInfo ? studioLinkInfo.value : studioLinkInfo;

   if (!("name" in maybeValue)) {
      console.warn(
         "getLinkRecordInfoWhenObject: 'name' property is missing in studioLinkInfo: ",
         JSON.stringify(studioLinkInfo),
      );
      console.warn("getLinkRecordInfoWhenObject: adding an empty string as name property.");
      maybeValue.name = "";
   }

   if (!isValidLinkValueObject(maybeValue))
      throw new Error(
         `useStudio: the 'studioLinkInfo' ${JSON.stringify(studioLinkInfo)} when object is expected to have an object with 'id' and 'name' but found ${typeof studioLinkInfo}.`,
      );

   return maybeValue;
}

/** @param {Object| null} value
 *  @returns {boolean} */
function isValidLinkValueObject(value) {
   if (!value) return false;

   return typeof value === "object" && "id" in value && "name" in value;
}

/** @param {Object} userLinkInfo
 * @returns {OwnerValue} */
function getUserRecordWhenObject(userLinkInfo) {
   if (isValidOwnerValueObject(userLinkInfo))
      return {
         id: userLinkInfo.id,
         name: userLinkInfo.name,
         email: userLinkInfo.email,
         permissionLevel: userLinkInfo.permissionLevel,
         profilePicUrl: userLinkInfo.profilePicUrl,
      };

   throw new Error(
      `getUserRecord: the 'userLinkInfo' ${JSON.stringify(userLinkInfo)} is expected to have an object with 'id', 'name' and 'email' but found ${typeof userLinkInfo}.`,
   );
}

/** @param {any} value */
function isValidOwnerValueObject(value) {
   return typeof value === "object" && ["id", "name", "email"].every((k) => k in value);
}

/**
 * Null-safe wrapper around record.getCellValue(field).
 * Returns null when the field wasn't resolved instead of crashing.
 * @param {any} record
 * @param {any} field
 * @returns {any}
 */
normalize.getCellValue = (record, field) => {
   if (!field) return null;
   return record.getCellValue(field);
};

/**
 * Null-safe wrapper around record.getCellValueAsString(field).
 * Returns "" when the field wasn't resolved instead of crashing.
 * @param {any} record
 * @param {any} field
 * @returns {string}
 */
normalize.getCellValueAsString = (record, field) => {
   if (!field) return "";
   return record.getCellValueAsString(field);
};

export default normalize;
