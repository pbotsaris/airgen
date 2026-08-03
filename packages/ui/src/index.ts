// Airtable-native components, root entry. No @airtable/blocks imports may
// exist anywhere under src/ — pinned by test/no-sdk.test.ts. SDK-bound
// features (RecordSelect, useBaseHighlight, field factory) arrive via the
// per-flavor entries in Phase 4.

export {Badge, type BadgeOptions, type BadgeProps} from './components/Badge.js';
export {Button, type ButtonProps, type ButtonSize, type ButtonVariant} from './components/Button.js';
export {ButtonToggle, type ButtonToggleProps} from './components/ButtonToggle.js';
export {Caret, type CaretProps} from './components/Caret.js';
export {CaretButton, type CaretButtonProps} from './components/CaretButton.js';
export {Circle, type CircleProps} from './components/Circle.js';
export {Divide, type DivideProps} from './components/Divide.js';
export {Icon, type IconComponent, type IconProps} from './components/Icon.js';
export {Input, type InputProps, type InputVariant} from './components/Input.js';
export {Label, type LabelProps} from './components/Label.js';
export {Portal, type PortalProps} from './components/Portal.js';
export {Spinner, LoadingOverlay, type SpinnerProps, type LoadingOverlayProps} from './components/Spinner.js';
export {Text, type TextProps, type TextVariant} from './components/Text.js';
export {Toggle, type ToggleProps, type ToggleSize} from './components/Toggle.js';

export {PillOption, type PillOptionProps} from './components/PillOption.js';
export {
  Select,
  type SelectProps,
  type SingleSelectProps,
  type MultiSelectProps,
  type SelectOptionState,
  type SelectTriggerArgs,
} from './components/Select.js';
export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverClose,
  type PopoverProps,
  type PopoverTriggerProps,
  type PopoverContentProps,
  type PopoverCloseProps,
} from './components/Popover.js';
export {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  type TooltipProps,
  type TooltipTriggerProps,
  type TooltipContentProps,
} from './components/Tooltip.js';
export {
  Dialog,
  Sheet,
  type SheetSide,
  type SheetContentProps,
  type DialogRootProps,
  type DialogTriggerProps,
  type DialogContentProps,
  type DialogCloseProps,
} from './components/DialogSheet.js';
export type {ToastType, ToastItem, ToastPosition} from './components/Toast.js';

export {ToastProvider, useToast, type ToastAPI, type ToastOptions, type ToastProviderProps} from './providers/ToastProvider.js';
export {
  SheetProvider,
  useSheet,
  type SheetAPI,
  type SheetRequest,
  type SheetRenderCtx,
  type SheetProviderProps,
} from './providers/SheetProvider.js';

export {airtableColorToHex, shouldUseLightText, isHexColor} from './colors.js';
export {pillSizeClasses} from './sizes.js';
export type {ComponentSize, IconSize} from './sizes.js';
export type {SelectOption, SelectGroup} from './types.js';
export type {Side, Align} from './positioning.js';
