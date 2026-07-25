// AI Multichannel System - Skeleton Component
import React from 'react';
import { cn } from '@/utils/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: boolean;
}

const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  width,
  height,
  animation = true,
  ...props
}) => {
  const baseClasses = cn(
    'bg-muted rounded-md',
    animation && 'animate-pulse',
    className
  );

  const style: React.CSSProperties = {
    width: width || (variant === 'circular' ? height : '100%'),
    height: height || (variant === 'text' ? '1rem' : '100%'),
    borderRadius: variant === 'circular' ? '50%' : variant === 'rounded' ? '0.5rem' : undefined,
  };

  return (
    <div
      className={baseClasses}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
};

// Pre-defined skeleton variants
const TextSkeleton: React.FC<Omit<SkeletonProps, 'variant'>> = (props) => (
  <Skeleton variant="text" {...props} />
);

const CircularSkeleton: React.FC<Omit<SkeletonProps, 'variant'>> = (props) => (
  <Skeleton variant="circular" {...props} />
);

const AvatarSkeleton: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <Skeleton variant="circular" width={size} height={size} />
);

const ParagraphSkeleton: React.FC<{ lines?: number; width?: string | number }> = ({
  lines = 3,
  width = '100%',
}) => (
  <div className="space-y-2">
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        width={i === lines - 1 ? '75%' : width}
        style={{ height: i === 0 ? '1.25rem' : '1rem' }}
      />
    ))}
  </div>
);

export {
  Skeleton as default,
  TextSkeleton,
  CircularSkeleton,
  AvatarSkeleton,
  ParagraphSkeleton,
};
