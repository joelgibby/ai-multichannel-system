// AI Multichannel System - Progress Component
import React from 'react';
import { cn } from '@/utils/cn';

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
}

const Progress: React.FC<ProgressProps> = ({
  className,
  value = 0,
  max = 100,
  variant = 'default',
  size = 'md',
  showLabel = false,
  label,
  ...props
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4',
  };

  const variantClasses = {
    default: 'bg-primary',
    primary: 'bg-primary',
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    destructive: 'bg-destructive',
  };

  return (
    <div className={cn('w-full', className)} {...props}>
      {showLabel && (
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>{label || `${Math.round(percentage)}%`}</span>
          <span>{value}/{max}</span>
        </div>
      )}
      <div
        className={cn(
          'w-full overflow-hidden rounded-full bg-muted',
          sizeClasses[size]
        )}
      >
        <div
          className={cn(
            'h-full transition-all duration-300 ease-in-out',
            variantClasses[variant]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

// Circular Progress
interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: ProgressProps['variant'];
  showLabel?: boolean;
}

const CircularProgress: React.FC<CircularProgressProps> = ({
  className,
  value = 0,
  max = 100,
  size = 40,
  strokeWidth = 4,
  variant = 'default',
  showLabel = false,
  ...props
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const variantClasses = {
    default: 'text-primary',
    primary: 'text-primary',
    success: 'text-green-500',
    warning: 'text-yellow-500',
    destructive: 'text-destructive',
  };

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        className="absolute top-0 left-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          className="text-muted"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
        />
        <circle
          className={cn('transition-all duration-300 ease-in-out', variantClasses[variant])}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      {showLabel && (
        <span className="text-sm font-medium">{Math.round(percentage)}%</span>
      )}
    </div>
  );
};

export { Progress as default, CircularProgress };
