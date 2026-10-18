/**
 * Entry point for Interface Extensions on the experimental Blocks SDK
 * (`@airtable/blocks@interface-alpha`), whose ui module lives at
 * `@airtable/blocks/interface/ui` and ships hooks but no component library.
 * The generated file imports back from 'airgen/interface' so its
 * createTypedHooks is bound to the same SDK flavor.
 */

import {useBase, useCustomProperties, useRecords, useWatchable} from '@airtable/blocks/interface/ui';
import {useMemo} from 'react';
import {createSchemaObserver} from './SchemaObserver.js';
import {makeCreateTypedHooks} from './useTypedRecords.js';
import {nullSafeUseRecords} from './sdk.js';
import type {BlocksSdkAdapter} from './sdk.js';

// This SDK's useRecords reads `table.id` unguarded; a deleted or hidden
// generated table must read as [] (adapter contract), not throw.
const sdk: BlocksSdkAdapter = {
  useBase,
  useRecords: nullSafeUseRecords(useBase, useRecords),
  useWatchable,
  useMemo,
  useCustomProperties,
};

export const SchemaObserver = createSchemaObserver(sdk, {hooksModule: 'airgen/interface', sdkFlavor: 'interface'});
export const createTypedHooks = makeCreateTypedHooks(sdk);

export type {SchemaObserverProps} from './SchemaObserver.js';
export type {
  AirgenMeta,
  AirgenTableMeta,
  AirgenFieldMeta,
  FieldInspectors,
  Record as TypedRecord,
  IncludedRecord,
  IncludeOptions,
  IncludeSpec,
  TypedHooksOptions,
} from './useTypedRecords.js';
export type {
  SdkBase,
  SdkTable,
  SdkField,
  SdkRecord,
  SdkCellValues,
  PermissionCheck,
  TableCustomProperty,
  BlocksSdkAdapter,
} from './sdk.js';
export * from './runtime/index.js';
export {generateTypeScriptFromBase, GENERATED_HEADER, META_VERSION} from './generator.js';
export type {BaseLike, TableLike, FieldLike, GeneratorOptions, SdkFlavor} from './generator.js';
export {computeSchemaSignature} from './schema-signature.js';
export {checkSchemaDrift} from './schema-drift.js';
export type {
  DriftReport,
  DriftFinding,
  DriftSeverity,
  DriftKind,
  DriftMetaLike,
  DriftChoicesLike,
  DriftResultMetaLike,
} from './schema-drift.js';
