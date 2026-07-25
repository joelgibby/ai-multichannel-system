// AI Multichannel System - Card Component
import React from 'react';
import { cn } from '@/utils/cn';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
  clickable?: boolean;
}

const Card: React.FC<CardProps> = ({
  className,
  variant = 'default',
  padding = 'md',
  hoverable = false,
  clickable = false,
  children,
  ...props
}) => {
  const variantClasses = {
    default: 'bg-card text-card-foreground border border-card-border',
    outline: 'bg-transparent border border-border',
    ghost: 'bg-transparent',
    elevated: 'bg-card text-card-foreground border border-card-border shadow-lg',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  return (
    <div
      className={cn(
        'rounded-lg transition-all duration-200',
        variantClasses[variant],
        paddingClasses[padding],
        hoverable && 'hover:shadow-md hover:-translate-y-0.5',
        clickable && 'cursor-pointer active:scale-[0.98]',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Card Header
interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}

const CardHeader: React.FC<CardHeaderProps> = ({
  className,
  title,
  description,
  action,
  children,
  ...props
}) => {
  return (
    <div
      className={cn('flex items-start justify-between mb-4', className)}
      {...props}
    >
      <div className="flex-1">
        {title && (
          <h3 className="text-lg font-semibold leading-none tracking-tight">{title}</h3>
        )}
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
        {children}
      </div>
      {action && <div className="ml-4">{action}</div>}
    </div>
  );
};

// Card Content
const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => {
  return <div className={cn('text-sm', className)} {...props} />;
};

// Card Footer
const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border',
        className
      )}
      {...props}
    />
  );
};

// Card Image
interface CardImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant?: 'top' | 'bottom' | 'left' | 'right';
}

const CardImage: React.FC<CardImageProps> = ({
  className,
  variant = 'top',
  src,
  alt,
  ...props
}) => {
  const variantClasses = {
    top: 'rounded-t-lg w-full',
    bottom: 'rounded-b-lg w-full',
    left: 'rounded-l-lg',
    right: 'rounded-r-lg',
  };

  return (
    <img
      src={src}
      alt={alt}
      className={cn('object-cover', variantClasses[variant], className)}
      {...props}
    />
  );
};

export {
  Card as default,
  CardHeader,
  CardContent,
  CardFooter,
  CardImage,
};
