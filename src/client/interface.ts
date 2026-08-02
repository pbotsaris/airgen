/**
 * Entry point for Interface Extensions on the experimental Blocks SDK
 * (`@airtable/blocks@interface-alpha`), whose ui module lives at
 * `@airtable/blocks/interface/ui` and ships hooks but no component library.
 * The generated file imports back from 'airgen/interface' so its
 * createTypedHooks is bound to the same SDK flavor.
 */

import {useBase, useRecords, useWatchable} from '@airtable/blocks/interface/ui';
import {createSchemaObserver} from './SchemaObserver.js';
import {makeCreateTypedHooks} from './useTypedRecords.js';
import type {BlocksSdkAdapter} from './sdk.js';

const sdk: BlocksSdkAdapter = {useBase, useRecords, useWatchable};

export const SchemaObserver = createSchemaObserver(sdk, {hooksModule: 'airgen/interface'});
export const createTypedHooks = makeCreateTypedHooks(sdk);

export type {SchemaObserverProps} from './SchemaObserver.js';
export type {AirgenMeta, AirgenTableMeta, AirgenFieldMeta, Record as TypedRecord} from './useTypedRecords.js';
export type {SdkBase, SdkTable, SdkField, SdkRecord, BlocksSdkAdapter} from './sdk.js';
export {generateTypeScriptFromBase, GENERATED_HEADER} from './generator.js';
export type {BaseLike, TableLike, FieldLike, GeneratorOptions} from './generator.js';
export {computeSchemaSignature} from './schema-signature.js';
