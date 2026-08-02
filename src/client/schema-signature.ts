/**
 * Canonical schema snapshot + fast synchronous hash.
 *
 * Used to decide "did the schema actually change?" without deep-comparing
 * SDK models, and embedded into the generated file as `airgenMeta.signature`.
 * FNV-1a instead of crypto.subtle because the observer needs a sync answer
 * on every schema event inside the extension iframe.
 */

export interface SignatureFieldLike {
  id: string;
  name: string;
  type: string;
  options?: {[key: string]: unknown} | null;
}

export interface SignatureTableLike {
  id: string;
  name: string;
  fields: ReadonlyArray<SignatureFieldLike>;
}

export interface SignatureBaseLike {
  id: string;
  tables: ReadonlyArray<SignatureTableLike>;
}

/** Subset of field options that affects generated types. */
function relevantOptions(field: SignatureFieldLike): unknown {
  const options = field.options;
  if (!options) return null;
  const out: {[key: string]: unknown} = {};
  if (Array.isArray(options.choices)) {
    out.choices = (options.choices as Array<{id?: unknown; name?: unknown; color?: unknown}>).map(
      choice => [choice.id, choice.name, choice.color],
    );
  }
  if (options.result && typeof options.result === 'object') {
    const result = options.result as {type?: unknown; options?: unknown};
    out.result = {
      type: result.type,
      options: result.options && typeof result.options === 'object' ? result.options : null,
    };
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function canonicalSchemaSnapshot(base: SignatureBaseLike): string {
  const tables = [...base.tables]
    .map(table => ({
      id: table.id,
      name: table.name,
      fields: [...table.fields]
        .map(field => ({
          id: field.id,
          name: field.name,
          type: field.type,
          options: relevantOptions(field),
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return JSON.stringify({baseId: base.id, tables});
}

/** 32-bit FNV-1a, hex encoded. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619, in 32-bit space without BigInt
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function computeSchemaSignature(base: SignatureBaseLike): string {
  return fnv1a(canonicalSchemaSnapshot(base));
}
