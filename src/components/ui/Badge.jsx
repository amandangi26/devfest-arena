import { cn } from '../../lib/utils';

/**
 * Neo-Brutalist Tag Pill / Badge component.
 * Source: design.md Section 5.4
 */
export function Badge({
  children,
  className,
  color = 'sand',
  withDot = false,
  dotColor = 'red',
  size = 'md',
  ...props
}) {
  const colors = {
    sand: 'bg-[#FFFBF0] text-black border-black',
    white: 'bg-white text-black border-black',
    yellow: 'bg-[#FBBC05] text-black border-black',
    blue: 'bg-[#4285F4] text-white border-black',
    green: 'bg-[#34A853] text-white border-black',
    red: 'bg-[#EA4335] text-white border-black',
    dark: 'bg-[#0D2818] text-white border-black',
  };

  const dotColors = {
    red: 'bg-[#EA4335]',
    green: 'bg-[#34A853]',
    yellow: 'bg-[#FBBC05]',
    blue: 'bg-[#4285F4]',
  };

  const sizes = {
    sm: 'text-[10px] px-2.5 py-0.5 border-[1.5px] shadow-[1.5px_1.5px_0_0_#000]',
    md: 'text-xs px-3.5 py-1 border-[2px] shadow-[2px_2px_0_0_#000]',
    lg: 'text-sm px-4 py-1.5 border-[2.5px] shadow-[3px_3px_0_0_#000]',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full font-black uppercase tracking-wider select-none',
        colors[color],
        sizes[size],
        className
      )}
      {...props}
    >
      {withDot && (
        <span
          className={cn(
            'w-2 h-2 rounded-full shrink-0 animate-pulse',
            dotColors[dotColor] || 'bg-[#EA4335]'
          )}
        />
      )}
      {children}
    </span>
  );
}
