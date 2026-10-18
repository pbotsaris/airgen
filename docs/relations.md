# Relations: `include`

Airtable links are the base's relationships, and the schema records where every `multipleRecordLinks` field points (`linkedTableId`). airgen bakes that into the generated `TableLinkMap` and `airgenMeta`, so a component names the links it wants followed and gets the linked table's typed rows instead of `{id, name}` stubs. There is nothing to declare. See [`examples/08-relations.tsx`](../examples/08-relations.tsx).

## Syntax

```ts
const people = useRecords('People', {include: {projects: {tasks: true}}});
people[0].fields.projects?.[0].fields.tasks?.[0].fields.title; // string | undefined
people[0].fields.projects?.[0].name; // the project's primary field
```

- `true` hydrates one link; an object hydrates it and goes on into the linked rows.
- A hydrated cell is `Array<IncludedRecord>`: full rows, `{id, name, fields, raw}`, typed by the linked table's `<Table>Record`. A link the spec doesn't name stays `LinkedRecord[]`; every other cell is untouched.
- `useQuery(key, {include, where, search})` takes the same spec. 
    - Filters and search still name the table's own field keys
    - a filter on a hydrated link matches the linked rows by id or by name (their primary field), as it does for plain `{id, name}` links.
- Every row carries `name`, the SDK's `record.name`, with or without `include`.

## Rules

Checked at compile time, and again at runtime for plain-JS callers:

- Only link fields whose target table is in the base are includable. `TableLinkMap` leaves out a link into a table the extension can't see.
- At most **two links deep**: `{projects: {tasks: true}}` is the limit.
- No cycles: a link whose target table is already on the include path is not offered. `useRecords('Projects', {include: {tasks: {project: true}}})` is a type error.
- Excess and unknown keys are errors, nested ones too.

At runtime a key that breaks a rule is skipped, its cell left as the SDK returned it, with one `console.warn` per key explaining why. Nothing throws.

## Drift

Retargeting a link in Airtable is `link-target-changed`, breaking, in both `useSchemaDrift` and the daemon's diff (usages are listed; there is no automatic fix, since the hydrated rows now have another shape). The target is part of the schema signature, so the observer regenerates the file.
