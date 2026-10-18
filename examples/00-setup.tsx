/**
 * Setup: the observer in development, the generated hooks everywhere.
 *
 * `<SchemaObserver />` watches the live base schema and streams the generated
 * `airtable-schema.ts` to the airgen daemon (`npx airgen`), which writes it to
 * disk while `block run` hot-reloads the extension. It is a dev tool: remove
 * it (or pass `enabled={false}`) before releasing. If it ships anyway, the
 * daemon is unreachable from a released origin and the panel just shows
 * "Disconnected".
 *
 * Import airgen from the entry that matches the SDK your extension uses:
 * `airgen` (stable `@airtable/blocks/ui`), `airgen/interface` (interface
 * extensions on `@airtable/blocks@interface-alpha`), or `airgen/base`.
 */
import React from 'react';
import {SchemaObserver} from 'airgen';
import {airgenMeta} from './airtable-schema';
import {ProjectList} from './01-reading';

export function App() {
  return (
    <>
      {/* `meta` lets the panel show schema drift between the live base and this file. */}
      <SchemaObserver meta={airgenMeta} />
      <ProjectList />
    </>
  );
}
