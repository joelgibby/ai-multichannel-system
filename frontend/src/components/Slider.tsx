// AI Multichannel System - Slider Component
// Wrapper around Radix UI Slider

import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/utils/cn';

type SliderRootProps = React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>;

interface SliderProps extends Omit<SliderRootProps, 'value' | 'defaultValue' | 'onValueChange'> {
  showValue?: boolean;
  label?: string;
  value?: number | number[];
  defaultValue?: number | number[];
  onValueChange?: (value: number) => void;
}

function toSliderValues(value: number | number[] | undefined): number[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  const values = Array.isArray(value) ? value : [value];
  return values.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, showValue = false, label, value, defaultValue, onValueChange, ...props }, ref) => {
  const sliderValue = toSliderValues(value);
  const sliderDefault = toSliderValues(defaultValue);
  const [displayValue, setDisplayValue] = React.useState(
    sliderValue?.[0] ?? sliderDefault?.[0] ?? 0
  );

  React.useEffect(() => {
    if (sliderValue?.[0] !== undefined) {
      setDisplayValue(sliderValue[0]);
    }
  }, [sliderValue?.[0]]);

  const handleValueChange = (newValue: number[]) => {
    const next = newValue[0];
    setDisplayValue(next);
    onValueChange?.(next);
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
        value={sliderValue}
        defaultValue={sliderDefault}
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
