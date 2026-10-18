/**
 * Entry point for regular Custom Extensions on the experimental Blocks SDK
 * (`@airtable/blocks@interface-alpha`), which renames the classic ui module
 * to `@airtable/blocks/base/ui`. The generated file imports back from
 * 'airgen/base' so its createTypedHooks is bound to the same SDK flavor.
 */

import * as ui from '@airtable/blocks/base/ui';
import {useMemo} from 'react';
import {createSchemaObserver} from './SchemaObserver.js';
import {makeCreateTypedHooks} from './useTypedRecords.js';
import type {BlocksSdkAdapter} from './sdk.js';

// No useCustomProperties: custom properties are an interface-SDK feature.
// useColorScheme off the namespace: early interface-alpha builds don't export it.
const sdk: BlocksSdkAdapter = {
  useBase: ui.useBase,
  useRecords: ui.useRecords,
  useWatchable: ui.useWatchable,
  useMemo,
  useColorScheme: ui.useColorScheme,
};

export const SchemaObserver = createSchemaObserver(sdk, {hooksModule: 'airgen/base', sdkFlavor: 'base'});
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
export type {BaseLike, TableLike, FieldLike, GeneratorOptions, SdkFlavor} from './generator.js';
export type {
  DriftReport,
  DriftFinding,
  DriftSeverity,
  DriftKind,
  DriftMetaLike,
  DriftChoicesLike,
  DriftResultMetaLike,
} from './schema-drift.js';

export {generateTypeScriptFromBase, GENERATED_HEADER, META_VERSION} from './generator.js';
export {computeSchemaSignature} from './schema-signature.js';
export {checkSchemaDrift} from './schema-drift.js';
