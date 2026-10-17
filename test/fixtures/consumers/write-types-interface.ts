/**
 * Interface-SDK flavor: the only write-shape difference is that
 * `multipleRecordLinks` also accepts a bare `{name}` to create-and-link.
 */
import type {ProjectsWrite} from './airtable-schema-interface';

export const linkByNameOrId: ProjectsWrite = {tasks: [{name: 'Created and linked'}, {id: 'recTask000000001'}]};

// @ts-expect-error everything else is unchanged across flavors
export const wrongScalar: ProjectsWrite = {budget: 'twelve'};
