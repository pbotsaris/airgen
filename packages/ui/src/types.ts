import type * as React from 'react';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  /** Airtable color name (e.g. "blueBright") or CSS hex — resolved via colors.ts. */
  color?: string;
  disabled?: boolean;
  /** Display text used for typeahead/search matching when `label` isn't a string. */
  textValue?: string;
  profilePicUrl?: string;
  /** Arbitrary payload for custom renderers. */
  data?: unknown;
  /** Group key; options sharing a key render under one header (see SelectGroup). */
  group?: string;
}

/**
 * Header metadata for an `option.group` key. Groups render in first-appearance
 * order of their options; this only supplies the header's label and color.
 */
export interface SelectGroup {
  key: string;
  /** Defaults to the key. */
  label?: React.ReactNode;
  /** Airtable color name or CSS hex, rendered as a header dot. */
  color?: string;
}
