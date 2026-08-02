/**
 * Ambient declarations for the experimental Blocks SDK entry points
 * (`interface-alpha` builds), which the stable 1.x devDependency doesn't
 * have. Deliberately loose: the entry points that import these paths
 * immediately re-type the hooks against `BlocksSdkAdapter` (sdk.ts), and the
 * real types come from the consumer's installed SDK. Compile-time only —
 * tsc doesn't emit input .d.ts files, so this never ships in dist/.
 */

declare module '@airtable/blocks/interface/ui' {
  export function useBase(): any;
  export function useWatchable(model: unknown, keys: ReadonlyArray<string>): void;
  export function useRecords(table: any): any;
}

declare module '@airtable/blocks/base/ui' {
  export function useBase(): any;
  export function useWatchable(model: unknown, keys: ReadonlyArray<string>): void;
  export function useRecords(table: any): any;
}
