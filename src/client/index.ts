/**
 * Entry point for classic Custom Extensions on the stable Blocks SDK
 * (`@airtable/blocks/ui`). Interface extensions on the experimental SDK
 * import 'airgen/interface' instead; regular extensions on the experimental
 * SDK import 'airgen/base'. The three entries differ only in which SDK ui
 * module supplies the hooks and which specifier the generated file imports.
 */

import {useBase, useRecords, useWatchable} from '@airtable/blocks/ui';
import {createSchemaObserver} from './SchemaObserver.js';
import {makeCreateTypedHooks} from './useTypedRecords.js';
import type {BlocksSdkAdapter} from './sdk.js';

const sdk: BlocksSdkAdapter = {
  useBase,
  useWatchable,
  // The SDK overloads take Table | View; airgen only ever passes the Table it
  // resolved from the same base, so the structural narrowing is safe.
  useRecords: useRecords as BlocksSdkAdapter['useRecords'],
};

export const SchemaObserver = createSchemaObserver(sdk);
export const createTypedHooks = makeCreateTypedHooks(sdk);

export type {SchemaObserverProps} from './SchemaObserver.js';
export type {AirgenMeta, AirgenTableMeta, AirgenFieldMeta, Record as TypedRecord} from './useTypedRecords.js';
export type {SdkBase, SdkTable, SdkField, SdkRecord, BlocksSdkAdapter} from './sdk.js';
export {generateTypeScriptFromBase, GENERATED_HEADER} from './generator.js';
export type {BaseLike, TableLike, FieldLike, GeneratorOptions} from './generator.js';
export {computeSchemaSignature} from './schema-signature.js';
export {checkSchemaDrift} from './schema-drift.js';
export type {DriftReport, DriftFinding, DriftSeverity, DriftKind, DriftMetaLike} from './schema-drift.js';
