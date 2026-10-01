"use client";

import { RadioGroup } from "radix-ui";
import { cn } from "../lib/cn";

export type SegmentedOption = { value: string; label: string; testId?: string };

export function SegmentedControl({
  options,
  value,
  onValueChange,
  className,
  "aria-label": ariaLabel,
  "data-testid": testId,
}: {
  options: SegmentedOption[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  "aria-label": string;
  "data-testid"?: string;
}) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={onValueChange}
      aria-label={ariaLabel}
      orientation="horizontal"
      data-testid={testId}
      className={cn(
        "inline-flex h-11 items-center gap-1 rounded-full border border-line bg-cream-200/70 p-1",
        className,
      )}
    >
      {options.map((option) => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          data-testid={option.testId}
          className="flex h-full min-w-0 flex-1 cursor-pointer items-center justify-center whitespace-nowrap rounded-full px-4 font-medium text-ink-800 text-sm transition-[color,background-color,box-shadow] duration-150 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sage-800 data-[state=checked]:bg-white data-[state=checked]:text-ink-900 data-[state=checked]:shadow-[0_1px_3px_rgb(58_58_58/0.12),0_0_0_1px_rgb(58_58_58/0.04)]"
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
