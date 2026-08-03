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
  xs: {h: 'h-5', px: 'px-control-x-xs', py: 'py-control-y-xs', text: 'text-xs'},
  sm: {h: 'h-6', px: 'px-control-x-sm', py: 'py-control-y-sm', text: 'text-sm'},
  base: {h: 'h-8', px: 'px-control-x-base', py: 'py-control-y-base', text: 'text-base'},
  lg: {h: 'h-9', px: 'px-control-x-lg', py: 'py-control-y-lg', text: 'text-lg'},
  xl: {h: 'h-10', px: 'px-control-x-xl', py: 'py-control-y-xl', text: 'text-xl'},
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
 * Pill metrics per control size. A pill nests inside a same-size control, so
 * its text sits one step below the control's text and its height stays under
 * the control height.
 */
export const PILL_SIZE: Record<ComponentSize, {pad: string; text: string; avatar: string; gap: string}> = {
  xs: {pad: 'px-1.5 py-px', text: 'text-[10px]', avatar: 'h-3 w-3', gap: 'gap-1'},
  sm: {pad: 'px-2 py-0.5', text: 'text-xs', avatar: 'h-4 w-4', gap: 'gap-1.5'},
  base: {pad: 'px-2.5 py-0.5', text: 'text-sm', avatar: 'h-5 w-5', gap: 'gap-2'},
  lg: {pad: 'px-3 py-1', text: 'text-base', avatar: 'h-6 w-6', gap: 'gap-2'},
  xl: {pad: 'px-3.5 py-1', text: 'text-lg', avatar: 'h-7 w-7', gap: 'gap-2'},
};

/** Classes for a pill nested inside a control of the given size. */
export function pillSizeClasses(size: ComponentSize = 'base'): string {
  const s = PILL_SIZE[size] || PILL_SIZE.base;
  return `${s.gap} ${s.pad} ${s.text}`;
}
