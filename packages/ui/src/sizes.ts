export type ComponentSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl';

/** Named icon sizes in px. `md` is a legacy alias of 16 (same as `lg`). */
export type IconSize = 'xs' | 'sm' | 'base' | 'md' | 'lg' | 'xl';

/**
 * Shared control size scale. Full literal Tailwind classes (JIT scans this
 * file). Padding values come from the `control-x-*` / `control-y-*` spacing
 * tokens in tailwind.config.cjs — change them there to retune every control
 * at once. `py` is the multiline equivalent of `h`: text line-height + 2*py +
 * 2px border === h.
 */
export const SIZE_SCALE: Record<ComponentSize, {h: string; px: string; py: string; text: string}> = {
  xs: {h: 'ag-h-5', px: 'ag-px-control-x-xs', py: 'ag-py-control-y-xs', text: 'ag-text-xs'},
  sm: {h: 'ag-h-6', px: 'ag-px-control-x-sm', py: 'ag-py-control-y-sm', text: 'ag-text-sm'},
  base: {h: 'ag-h-8', px: 'ag-px-control-x-base', py: 'ag-py-control-y-base', text: 'ag-text-base'},
  lg: {h: 'ag-h-9', px: 'ag-px-control-x-lg', py: 'ag-py-control-y-lg', text: 'ag-text-lg'},
  xl: {h: 'ag-h-10', px: 'ag-px-control-x-xl', py: 'ag-py-control-y-xl', text: 'ag-text-xl'},
};

export const ICON_SIZES: Record<IconSize, number> = {xs: 10, sm: 12, base: 14, md: 16, lg: 16, xl: 18};

/** Maps a control size to the matching Icon size. */
export const SIZE_TO_ICON: Record<ComponentSize, IconSize> = {xs: 'xs', sm: 'sm', base: 'base', lg: 'lg', xl: 'xl'};

/**
 * Classes for fixed-height single-line controls (Button, Input, InlineEdit
 * input mode).
 */
export function controlSizeClasses(size: ComponentSize = 'base'): string {
  const s = SIZE_SCALE[size] || SIZE_SCALE.base;
  return `${s.h} ${s.px} ${s.text}`;
}

/**
 * Classes for multiline / padding-based controls (textarea, view buttons).
 * A single line of text lands on the same height as `controlSizeClasses`.
 */
export function multilineSizeClasses(size: ComponentSize = 'base'): string {
  const s = SIZE_SCALE[size] || SIZE_SCALE.base;
  return `${s.px} ${s.py} ${s.text}`;
}

/**
 * Pill metrics per control size. A pill nests inside a same-size control and
 * stays around 60% of its height (`ag-leading-none`: text + 2 * py). From
 * `base` down the pill takes the control's own text size, so a selected pill
 * reads as large as the text around it; `lg` and `xl` sit one step below.
 */
export const PILL_SIZE: Record<ComponentSize, {pad: string; text: string; avatar: string; gap: string}> = {
  xs: {pad: 'ag-px-1.5 ag-py-px', text: 'ag-text-[10px]', avatar: 'ag-h-3 ag-w-3', gap: 'ag-gap-1'},
  sm: {pad: 'ag-px-2 ag-py-0.5', text: 'ag-text-sm', avatar: 'ag-h-4 ag-w-4', gap: 'ag-gap-1.5'},
  base: {pad: 'ag-px-2.5 ag-py-[3px]', text: 'ag-text-base', avatar: 'ag-h-5 ag-w-5', gap: 'ag-gap-2'},
  lg: {pad: 'ag-px-3 ag-py-1', text: 'ag-text-base', avatar: 'ag-h-6 ag-w-6', gap: 'ag-gap-2'},
  xl: {pad: 'ag-px-3.5 ag-py-1', text: 'ag-text-lg', avatar: 'ag-h-7 ag-w-7', gap: 'ag-gap-2'},
};

/** Classes for a pill nested inside a control of the given size. */
export function pillSizeClasses(size: ComponentSize = 'base'): string {
  const s = PILL_SIZE[size] || PILL_SIZE.base;
  return `${s.gap} ${s.pad} ${s.text}`;
}
