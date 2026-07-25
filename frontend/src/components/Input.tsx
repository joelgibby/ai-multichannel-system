// AI Multichannel System - Input Component
import React, { forwardRef, useState } from 'react';
import { Eye, EyeOff, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = 'text',
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword && showPassword ? 'text' : type;

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-sm font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            type={inputType}
            className={cn(
              `
                flex h-10 w-full rounded-md border border-input bg-background
                px-3 py-2 text-sm ring-offset-background
                file:border-0 file:bg-transparent file:text-sm file:font-medium
                placeholder:text-muted-foreground
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                focus-visible:ring-offset-2
                disabled:cursor-not-allowed disabled:opacity-50
              `,
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-destructive',
              className
            )}
            disabled={disabled}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          )}
          {rightIcon && !isPassword && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="text-sm font-medium text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {error}
          </p>
        )}
        {hint && !error && (
          <p className="text-sm text-muted-foreground">{hint}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
