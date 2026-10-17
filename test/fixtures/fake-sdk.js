/**
 * Structural fakes for the SDK table and record surface the runtime writes
 * against (`SdkTable`, `SdkRecord` in sdk.ts). Built from a `mock-base.js`
 * table, so fields carry the same id/name/type/options/isComputed a live base
 * would. Every SDK call is recorded in `calls` as `[method, payload]`.
 */

/**
 * @param {object} tableFixture a table from mockBase
 * @param {object} [behavior]
 * @param {{create?: string, update?: string, delete?: string}} [behavior.deny] reason per denied operation
 * @param {number} [behavior.failWriteCall] 0-based index of the write call that rejects
 */
export function fakeTable(tableFixture, {deny = {}, failWriteCall = -1} = {}) {
  const fields = new Map(tableFixture.fields.map(field => [field.id, field]));
  const calls = [];
  let writeCalls = 0;
  let nextId = 1;

  const check = operation => payload => {
    calls.push([`check-${operation}`, payload]);
    return deny[operation] ? {hasPermission: false, reasonDisplayString: deny[operation]} : {hasPermission: true};
  };

  const write = (operation, result) => async payload => {
    calls.push([operation, payload]);
    if (writeCalls++ === failWriteCall) throw new Error(`${operation} failed`);
    return result(payload);
  };

  return {
    id: tableFixture.id,
    name: tableFixture.name,
    fields: tableFixture.fields,
    // The fixture's primaryField is a bare {id}; the SDK's is the Field itself.
    primaryField: fields.get(tableFixture.primaryField?.id) ?? tableFixture.fields[0],
    calls,
    getFieldByIdIfExists: id => fields.get(id) ?? null,
    createRecordsAsync: write('create', batch => batch.map(() => `recNew${String(nextId++).padStart(11, '0')}`)),
    updateRecordsAsync: write('update', () => undefined),
    deleteRecordsAsync: write('delete', () => undefined),
    checkPermissionsForCreateRecords: check('create'),
    checkPermissionsForUpdateRecords: check('update'),
    checkPermissionsForDeleteRecords: check('delete'),
  };
}

/** A record whose cells are keyed by field id. */
export function fakeRecord(id, cellsByFieldId) {
  return {
    id,
    name: id,
    getCellValue: field => cellsByFieldId[field.id] ?? null,
    getCellValueAsString: field => String(cellsByFieldId[field.id] ?? ''),
  };
}

/** Write calls only (no permission checks), as `[method, payload]`. */
export function writes(table) {
  return table.calls.filter(([method]) => !method.startsWith('check-'));
}

/** A structural `SdkBase` over fake tables (or plain table fixtures, wrapped). */
export function fakeBase(tables) {
  const wrapped = tables.map(table => ('calls' in table ? table : fakeTable(table)));
  return {
    id: 'appFake0000000001',
    name: 'Fake Base',
    tables: wrapped,
    getTableByIdIfExists: id => wrapped.find(table => table.id === id) ?? null,
    getTableByNameIfExists: name => wrapped.find(table => table.name === name) ?? null,
  };
}

/**
 * A `BlocksSdkAdapter` of plain functions, so `createTypedHooks(meta)` runs
 * without React: hooks are just called. `records` maps table id → SDK
 * records. `customProperties` (a function of the definitions, returning
 * `customPropertyValueByKey`) adds the interface-only hook. Every `useMemo`
 * and `useCustomProperties` call is recorded for assertions.
 */
export function fakeAdapter(base, {records = {}, customProperties} = {}) {
  const memoCalls = [];
  const customPropertyCalls = [];

  const adapter = {
    memoCalls,
    customPropertyCalls,
    useBase: () => base,
    useWatchable: () => {},
    useRecords: table => (table ? (records[table.id] ?? []) : null),
    useMemo: (factory, deps) => {
      memoCalls.push(deps);
      return factory();
    },
  };

  if (customProperties) {
    adapter.useCustomProperties = getDefinitions => {
      customPropertyCalls.push(getDefinitions);
      return {customPropertyValueByKey: customProperties(getDefinitions(base))};
    };
  }

  return adapter;
}
