// AI Multichannel System - Toast Component
// Wrapper for react-hot-toast with custom styling

import React from 'react';
import { useToast, Toaster as HotToaster } from 'react-hot-toast';
import { cn } from '@/utils/cn';
import { AlertCircle, CheckCircle, Info, XCircle, X } from 'lucide-react';

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info' | 'default';

interface ToastProps {
  type?: ToastType;
  title?: string;
  message: string;
  duration?: number;
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  dismissible?: boolean;
  onDismiss?: () => void;
}

// Toast icon mapping
const TOAST_ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-green-500" />,
  error: <XCircle className="w-5 h-5 text-destructive" />,
  warning: <AlertCircle className="w-5 h-5 text-yellow-500" />,
  info: <Info className="w-5 h-5 text-blue-500" />,
  default: <Info className="w-5 h-5" />,
};

// Toast background colors
const TOAST_BG: Record<ToastType, string> = {
  success: 'bg-green-500/10',
  error: 'bg-destructive/10',
  warning: 'bg-yellow-500/10',
  info: 'bg-blue-500/10',
  default: 'bg-muted',
};

// Toast text colors
const TOAST_TEXT: Record<ToastType, string> = {
  success: 'text-green-600',
  error: 'text-destructive',
  warning: 'text-yellow-600',
  info: 'text-blue-600',
  default: 'text-foreground',
};

// Custom toast component
const Toast: React.FC<ToastProps> = ({
  type = 'default',
  title,
  message,
  duration = 4000,
  position = 'top-right',
  dismissible = true,
  onDismiss,
}) => {
  const { toast } = useToast();

  React.useEffect(() => {
    const toastId = toast.custom(
      (t) => (
        <div
          className={cn(
            `
              relative w-full max-w-sm overflow-hidden rounded-lg border
              shadow-lg animate-in slide-in-from-top-2 duration-300
              ${TOAST_BG[type]}
            `
          )}
          onClick={() => dismissible && toast.dismiss(t.id)}
        >
          <div className="flex p-4">
            <div className="flex-shrink-0">
              {TOAST_ICONS[type]}
            </div>
            <div className="ml-3 flex-1">
              {title && (
                <div className={cn('font-semibold', TOAST_TEXT[type])}>
                  {title}
                </div>
              )}
              <div className={cn('text-sm mt-1', TOAST_TEXT[type])}>
                {message}
              </div>
            </div>
            {dismissible && (
              <div className="flex-shrink-0 ml-4">
                <button
                  className="p-1 rounded hover:bg-muted/50 transition-colors"
                  onClick={() => toast.dismiss(t.id)}
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>
      ),
      { duration, position }
    );

    return () => {
      toast.dismiss(toastId);
    };
  }, [type, title, message, duration, position, dismissible, onDismiss]);

  return null;
};

// Toaster component - should be placed in _app.tsx
interface ToasterProps {
  position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  reverseOrder?: boolean;
  gutter?: number;
  toastOptions?: {
    duration?: number;
    style?: React.CSSProperties;
    className?: string;
  };
}

const Toaster: React.FC<ToasterProps> = ({
  position = 'top-right',
  reverseOrder = false,
  gutter = 8,
  toastOptions = {},
}) => {
  return (
    <HotToaster
      position={position}
      reverseOrder={reverseOrder}
      gutter={gutter}
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--background)',
          color: 'var(--foreground)',
          border: '1px solid var(--border)',
          borderRadius: '0.5rem',
          padding: '1rem',
          ...toastOptions.style,
        },
        className: cn('shadow-lg', toastOptions.className),
        ...toastOptions,
      }}
    />
  );
};

// Hook for easy toast creation
const useCustomToast = () => {
  const { toast } = useToast();

  const showToast = (
    type: ToastType,
    message: string,
    options?: Omit<ToastProps, 'type' | 'message'>
  ) => {
    return toast.custom(
      (t) => (
        <div
          className={cn(
            `
              relative w-full max-w-sm overflow-hidden rounded-lg border
              shadow-lg animate-in slide-in-from-top-2 duration-300
              ${TOAST_BG[type]}
            `
          )}
        >
          <div className="flex p-4">
            <div className="flex-shrink-0">
              {TOAST_ICONS[type]}
            </div>
            <div className="ml-3 flex-1">
              {options?.title && (
                <div className={cn('font-semibold', TOAST_TEXT[type])}>
                  {options.title}
                </div>
              )}
              <div className={cn('text-sm mt-1', TOAST_TEXT[type])}>
                {message}
              </div>
            </div>
            {(options?.dismissible ?? true) && (
              <div className="flex-shrink-0 ml-4">
                <button
                  className="p-1 rounded hover:bg-muted/50 transition-colors"
                  onClick={() => toast.dismiss(t.id)}
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            )}
          </div>
        </div>
      ),
      {
        duration: options?.duration ?? 4000,
        position: options?.position ?? 'top-right',
      }
    );
  };

  const success = (message: string, options?: Omit<ToastProps, 'type' | 'message'>) =>
    showToast('success', message, options);

  const error = (message: string, options?: Omit<ToastProps, 'type' | 'message'>) =>
    showToast('error', message, options);

  const warning = (message: string, options?: Omit<ToastProps, 'type' | 'message'>) =>
    showToast('warning', message, options);

  const info = (message: string, options?: Omit<ToastProps, 'type' | 'message'>) =>
    showToast('info', message, options);

  return {
    toast: showToast,
    success,
    error,
    warning,
    info,
  };
};

export {
  Toast as default,
  Toaster,
  useCustomToast,
};
