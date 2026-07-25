// AI Multichannel System - Avatar Component
import React from 'react';
import { cn } from '@/utils/cn';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  variant?: 'circular' | 'square' | 'rounded';
  fallback?: React.ReactNode;
  status?: 'online' | 'offline' | 'busy' | 'away' | null;
}

const SIZE_CLASSES = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-base',
  lg: 'w-12 h-12 text-lg',
  xl: 'w-16 h-16 text-xl',
};

const VARIANT_CLASSES = {
  circular: 'rounded-full',
  square: 'rounded-none',
  rounded: 'rounded-lg',
};

const STATUS_CLASSES = {
  online: 'bg-green-500',
  offline: 'bg-muted-foreground',
  busy: 'bg-red-500',
  away: 'bg-yellow-500',
};

const STATUS_SIZE = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-4 h-4',
};

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  size = 'md',
  variant = 'circular',
  fallback,
  status = null,
  className,
  ...props
}) => {
  const sizeClass = typeof size === 'number' ? `w-${size} h-${size}` : SIZE_CLASSES[size];
  const variantClass = VARIANT_CLASSES[variant];
  const statusSize = typeof size === 'number' ? 'w-2.5 h-2.5' : STATUS_SIZE[size];
  const statusClass = status ? STATUS_CLASSES[status] : '';

  // Generate fallback from alt text or use provided fallback
  const fallbackContent = fallback || (
    alt ? alt.charAt(0).toUpperCase() : '?'
  );

  const hasImage = !!src;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      {...props}
    >
      <div
        className={cn(
          'overflow-hidden',
          sizeClass,
          variantClass,
          hasImage ? '' : 'bg-muted flex items-center justify-center'
        )}
      >
        {hasImage ? (
          <img
            src={src}
            alt={alt}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
            }}
          />
        ) : (
          <span className="text-muted-foreground font-medium">
            {fallbackContent}
          </span>
        )}
      </div>

      {/* Status indicator */}
      {status && (
        <div
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-background',
            statusSize,
            statusClass
          )}
        />
      )}
    </div>
  );
};

// Avatar group component
interface AvatarGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  avatars: AvatarProps[];
  max?: number;
  size?: AvatarProps['size'];
  variant?: AvatarProps['variant'];
}

const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  max = 3,
  size = 'md',
  variant = 'circular',
  className,
  ...props
}) => {
  const visibleAvatars = avatars.slice(0, max);
  const remaining = avatars.length - max;

  return (
    <div
      className={cn('flex items-center -space-x-2', className)}
      {...props}
    >
      {visibleAvatars.map((avatar, index) => (
        <Avatar
          key={index}
          {...avatar}
          size={size}
          variant={variant}
          className="border-2 border-background"
        />
      ))}
      {remaining > 0 && (
        <Avatar
          size={size}
          variant={variant}
          className="border-2 border-background"
          fallback={`+${remaining}`}
        />
      )}
    </div>
  );
};

export { Avatar as default, AvatarGroup };
