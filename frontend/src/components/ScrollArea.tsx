// AI Multichannel System - Scroll Area Component
// Wrapper around Radix UI Scroll Area

import React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '@/utils/cn';

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn('relative overflow-hidden', className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport className="h-full w-full rounded-[inherit]">
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Scrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.Scrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-[1px]',
      orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-[1px]',
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Thumb
      className={cn(
        'relative flex-1 rounded-full bg-muted',
        orientation === 'vertical' && 'min-h-[20px]',
        orientation === 'horizontal' && 'min-w-[20px]'
      )}
    />
  </ScrollAreaPrimitive.Scrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.Scrollbar.displayName;

const ScrollAreaScrollbarVisible = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Scrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.Scrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      'flex touch-none select-none transition-colors',
      orientation === 'vertical' && 'h-full w-2.5 border-l border-l-transparent p-[1px]',
      orientation === 'horizontal' && 'h-2.5 flex-col border-t border-t-transparent p-[1px]',
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.Thumb
      className={cn(
        'relative flex-1 rounded-full bg-muted',
        orientation === 'vertical' && 'min-h-[20px]',
        orientation === 'horizontal' && 'min-w-[20px]'
      )}
    />
  </ScrollAreaPrimitive.Scrollbar>
));
ScrollAreaScrollbarVisible.displayName = 'ScrollAreaScrollbarVisible';

const ScrollAreaScrollbarHidden = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Scrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Scrollbar>
>(({ className, ...props }, ref) => (
  <ScrollAreaPrimitive.Scrollbar
    ref={ref}
    className={cn('hidden', className)}
    {...props}
  />
));
ScrollAreaScrollbarHidden.displayName = 'ScrollAreaScrollbarHidden';

export {
  ScrollArea as default,
  ScrollBar,
  ScrollAreaScrollbarVisible,
  ScrollAreaScrollbarHidden,
};
