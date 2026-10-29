import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

/**
 * Neo-Brutalist Tactile Button component adhering to DevFest Ranchi 2026 design specifications.
 * Source: design.md Section 5.1
 */
export const Button = forwardRef(function Button(
  {
    children,
    className,
    variant = 'primary',
    size = 'md',
    disabled = false,
    type = 'button',
    as: Component = 'button',
    ...props
  },
  ref
) {
  const baseStyles =
    'inline-flex items-center justify-center font-black uppercase tracking-wider select-none border-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBBC05] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none';

  const variants = {
    primary:
      'bg-[#4285F4] text-white border-[2.5px] shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
    secondary:
      'bg-[#FBBC05] text-black border-[2.5px] shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
    success:
      'bg-[#34A853] text-white border-[2.5px] shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
    danger:
      'bg-[#EA4335] text-white border-[2.5px] shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
    outline:
      'bg-white text-black border-[2.5px] shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none hover:bg-[#FFFBF0]',
    dark:
      'bg-[#0D2818] text-white border-[2.5px] shadow-[4px_4px_0_0_#000] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_0_#000] active:translate-x-[4px] active:translate-y-[4px] active:shadow-none',
    ghost:
      'bg-transparent text-black border-transparent shadow-none hover:bg-black/5 active:bg-black/10',
  };

  const sizes = {
    sm: 'text-xs px-3.5 py-1.5 rounded-full gap-1.5 min-h-[36px]',
    md: 'text-sm px-6 py-2.5 rounded-[22px] gap-2 min-h-[44px]',
    lg: 'text-base px-8 py-3.5 rounded-full gap-3 min-h-[52px]',
  };

  return (
    <Component
      ref={ref}
      type={Component === 'button' ? type : undefined}
      disabled={disabled}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </Component>
  );
});
