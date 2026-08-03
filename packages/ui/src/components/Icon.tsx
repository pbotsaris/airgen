import {ICON_SIZES, type IconSize} from '../sizes.js';

/** Shape of a lucide-react icon component (or anything compatible). */
export type IconComponent = React.ComponentType<{size?: number | string; className?: string}>;

export interface IconProps {
  /** A lucide-react icon component. */
  icon: IconComponent;
  /** Named size or pixel number. */
  size?: IconSize | number;
  className?: string;
}

/** Renders a lucide-react icon component with standardized sizing. */
export function Icon({icon: LucideIcon, size = 'base', className = ''}: IconProps) {
  if (!LucideIcon) return null;

  const pixelSize = typeof size === 'number' ? size : ICON_SIZES[size];

  return <LucideIcon size={pixelSize} className={className} />;
}
