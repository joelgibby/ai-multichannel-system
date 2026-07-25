// AI Multichannel System - Slider Component
// Wrapper around Radix UI Slider

import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/utils/cn';

interface SliderProps extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root> {
  showValue?: boolean;
  label?: string;
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, showValue = false, label, value, onValueChange, ...props }, ref) => {
  const [displayValue, setDisplayValue] = React.useState(value || props.defaultValue || 0);

  React.useEffect(() => {
    if (value !== undefined) {
      setDisplayValue(value);
    }
  }, [value]);

  const handleValueChange = (newValue: number[]) => {
    if (onValueChange) {
      onValueChange(newValue);
    }
    setDisplayValue(newValue[0]);
  };

  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <SliderPrimitive.Root
        ref={ref}
        className={cn('relative flex w-full touch-none select-none items-center', className)}
        value={value}
        onValueChange={handleValueChange}
        {...props}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Range className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Root>
      {showValue && (
        <div className="text-sm text-muted-foreground text-center">
          {displayValue}
        </div>
      )}
    </div>
  );
});

Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider };

export default Slider;
