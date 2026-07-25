// AI Multichannel System - Badge Component
import React from 'react';
import { cn } from '@/utils/cn';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'md', dot = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-muted text-foreground',
      primary: 'bg-primary/10 text-primary border-primary',
      secondary: 'bg-secondary/10 text-secondary border-secondary',
      destructive: 'bg-destructive/10 text-destructive border-destructive',
      success: 'bg-green-500/10 text-green-500 border-green-500',
      warning: 'bg-yellow-500/10 text-yellow-500 border-yellow-500',
    };

    const sizes = {
      sm: 'px-2 py-0.5 text-xs',
      md: 'px-2.5 py-0.5 text-sm',
      lg: 'px-3 py-1 text-sm',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'mr-1.5 h-1.5 w-1.5 rounded-full',
              variant === 'primary' && 'bg-primary',
              variant === 'secondary' && 'bg-secondary',
              variant === 'destructive' && 'bg-destructive',
              variant === 'success' && 'bg-green-500',
              variant === 'warning' && 'bg-yellow-500',
              variant === 'default' && 'bg-muted-foreground'
            )}
          />
        )}
        {children}
      </div>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
