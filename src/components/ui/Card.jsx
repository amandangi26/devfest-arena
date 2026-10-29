import { cn } from '../../lib/utils';

/**
 * Neo-Brutalist Card component with strict black borders and hard drop shadows.
 * Source: design.md Section 5.3
 */
export function Card({
  children,
  className,
  surface = 'white',
  shadow = 'md',
  border = 'base',
  rounded = 'xl',
  interactive = false,
  ...props
}) {
  const surfaces = {
    white: 'bg-white',
    sand: 'bg-[#FFFBF0]',
    cream: 'bg-[#FFF8E7]',
    green: 'bg-[#0D2818] text-white',
    bluePod: 'bg-[#EEF4FF]',
    greenPod: 'bg-[#EEFBF3]',
    redPod: 'bg-[#FFF5F5]',
    yellowPod: 'bg-[#FFFDEE]',
  };

  const borders = {
    sm: 'border-[1.5px] border-black',
    base: 'border-[2.5px] border-black',
    thick: 'border-[3px] border-black',
  };

  const shadows = {
    sm: 'shadow-[2px_2px_0_0_#000]',
    md: 'shadow-[4px_4px_0_0_#000]',
    lg: 'shadow-[6px_6px_0_0_#000]',
    xl: 'shadow-[8px_8px_0_0_#000]',
    none: 'shadow-none',
  };

  const radiuses = {
    md: 'rounded-[16px]',
    lg: 'rounded-[20px]',
    xl: 'rounded-[24px]',
    '2xl': 'rounded-[32px]',
  };

  const interactiveStyles = interactive
    ? 'hover:-translate-y-1 hover:shadow-[8px_8px_0_0_#000] transition-all'
    : '';

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        surfaces[surface],
        borders[border],
        shadows[shadow],
        radiuses[rounded],
        interactiveStyles,
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
