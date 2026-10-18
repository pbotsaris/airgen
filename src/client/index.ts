/**
 * Entry point for classic Custom Extensions on the stable Blocks SDK
 * (`@airtable/blocks/ui`). Interface extensions on the experimental SDK
 * import 'airgen/interface' instead; regular extensions on the experimental
 * SDK import 'airgen/base'. The three entries differ only in which SDK ui
 * module supplies the hooks and which specifier the generated file imports.
 */

import * as ui from '@airtable/blocks/ui';
import {useMemo} from 'react';
import {createSchemaObserver} from './SchemaObserver.js';
import {makeCreateTypedHooks} from './useTypedRecords.js';
import type {BlocksSdkAdapter} from './sdk.js';

// No useCustomProperties: custom properties are an interface-SDK feature.
const sdk: BlocksSdkAdapter = {
  useBase: ui.useBase,
  useWatchable: ui.useWatchable,
  useMemo,
  // The SDK overloads take Table | View; airgen only ever passes the Table it
  // resolved from the same base, so the structural narrowing is safe.
  useRecords: ui.useRecords as BlocksSdkAdapter['useRecords'],
  // Read off the namespace: the peer range starts before 1.19 added it, and a
  // named import of a missing export breaks the bundle.
  useColorScheme: (ui as Partial<Pick<typeof ui, 'useColorScheme'>>).useColorScheme,
};

export const SchemaObserver = createSchemaObserver(sdk);
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
