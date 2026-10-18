import type * as React from 'react';

/**
 * Choice shared by Select, PillOption, and ButtonToggle. Values identify choices;
 * labels provide display content. Supply `textValue` when using a rich label.
 *
 * @example
 * ```tsx
 * const option: SelectOption = {value: 'done', label: 'Done', color: 'greenBright'};
 * ```
 */
export interface SelectOption {
  /** Unique identifier emitted by selection callbacks. */
  value: string;
  /** Display content; use `textValue` for matching when this is not a string. */
  label: React.ReactNode;
  /** Airtable color name (e.g. "blueBright") or CSS hex — resolved via colors.ts. */
  color?: string;
  /** Visible but unavailable for selection in Select. */
  disabled?: boolean;
  /** Display text used for typeahead/search matching when `label` isn't a string. */
  textValue?: string;
  /** Avatar image URL displayed alongside the label. */
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
