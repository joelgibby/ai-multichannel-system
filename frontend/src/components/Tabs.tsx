// AI Multichannel System - Tabs Component
// Wrapper around Radix UI Tabs

import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/utils/cn';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md bg-muted p-[2px] text-muted-foreground',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      `
        inline-flex items-center justify-center whitespace-nowrap rounded
        px-3 py-1.5 text-sm font-medium ring-offset-background
        transition-all focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-ring focus-visible:ring-offset-2
        disabled:pointer-events-none disabled:opacity-50
        data-[state=active]:bg-background data-[state=active]:text-foreground
        data-[state=active]:shadow-sm
        hover:text-foreground
      `,
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

const TabsIndicator = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Indicator>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Indicator>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Indicator
    ref={ref}
    className={cn(
      'top-0 z-[1] h-full w-2 rounded-[1px] bg-primary transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
      className
    )}
    {...props}
  />
));
TabsIndicator.displayName = TabsPrimitive.Indicator.displayName;

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  TabsIndicator,
};

export default Tabs;
