/**
 * Ambient declarations for the experimental Blocks SDK entry points
 * (`interface-alpha` builds), which the stable 1.x devDependency doesn't
 * have. Deliberately loose: the entry points that import these paths
 * immediately re-type the hooks against `BlocksSdkAdapter` (sdk.ts), and the
 * real types come from the consumer's installed SDK. Compile-time only —
 * tsc doesn't emit input .d.ts files, so this never ships in dist/.
 *
 * Model-level surface (Table.createRecordsAsync / updateRecordsAsync /
 * deleteRecordsAsync, checkPermissionsFor*Records, Field.isComputed,
 * Table.primaryField) rides on `useBase(): any` and is narrowed structurally
 * by `SdkTable` / `SdkField` in sdk.ts — there is nothing to declare here for
 * it. `useCustomProperties` is interface-only: the base and stable flavors
 * leave the adapter slot undefined (see BlocksSdkAdapter).
 */

declare module '@airtable/blocks/interface/ui' {
  export function useBase(): any;
  export function useWatchable(model: unknown, keys: ReadonlyArray<string>): void;
  export function useRecords(table: any): any;
  /**
   * Mirrors `interface/ui/use_custom_properties.d.ts`: `getCustomProperties`
   * must have a stable identity and returns `BlockPageElementCustomProperty[]`
   * (boolean | string | enum | field | table definitions).
   */
  export function useCustomProperties(getCustomProperties: (base: any) => ReadonlyArray<unknown>): {
    customPropertyValueByKey: {[key: string]: unknown};
    errorState: {error: Error} | null;
  };
}

declare module '@airtable/blocks/base/ui' {
  export function useBase(): any;
  export function useWatchable(model: unknown, keys: ReadonlyArray<string>): void;
  export function useRecords(table: any): any;
}
