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

export {airtableColorToHex, shouldUseLightText, isHexColor} from './colors.js';
export type {ComponentSize, IconSize} from './sizes.js';
export type {SelectOption, SelectGroup} from './types.js';
