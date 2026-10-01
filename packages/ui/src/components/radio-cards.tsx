"use client";

import { Check } from "lucide-react";
import { RadioGroup } from "radix-ui";
import { type ReactNode, useId } from "react";
import { cn } from "../lib/cn";

export type RadioCardOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  testId?: string;
};

export function RadioCards({
  label,
  options,
  name,
  value,
  defaultValue,
  onValueChange,
  className,
  "data-testid": testId,
}: {
  label: string;
  options: RadioCardOption[];
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  "data-testid"?: string;
}) {
  const labelId = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-[13px] font-medium text-ink-800">
        {label}
      </span>
      <RadioGroup.Root
        name={name}
        value={value}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        aria-labelledby={labelId}
        data-testid={testId}
        className={cn("grid grid-cols-2 gap-2", className)}
      >
        {options.map((option) => {
          const optionLabelId = `${labelId}-${option.value}-label`;
          const descriptionId = `${labelId}-${option.value}-description`;
          const text = (
            <span className="flex min-w-0 flex-col gap-0.5">
              <span
                id={optionLabelId}
                className="truncate font-medium text-[15px] text-ink-900"
              >
                {option.label}
              </span>
              {option.description && (
                <span id={descriptionId} className="text-[13px] text-ink-800">
                  {option.description}
                </span>
              )}
            </span>
          );
          return (
            <RadioGroup.Item
              key={option.value}
              value={option.value}
              data-testid={option.testId}
              aria-labelledby={optionLabelId}
              aria-describedby={option.description ? descriptionId : undefined}
              className="group flex min-h-12 min-w-0 cursor-pointer items-center gap-2.5 rounded-field border border-line bg-white px-3 py-2.5 text-left shadow-[0_1px_2px_rgb(58_58_58/0.05)] transition-[border-color,background-color,box-shadow] duration-150 hover:border-line-field/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-800 data-[state=checked]:border-sage-800 data-[state=checked]:bg-sage-100/40 data-[state=checked]:shadow-[inset_0_0_0_1px_var(--color-sage-800)]"
            >
              {option.icon ? (
                <span
                  aria-hidden="true"
                  className="relative flex size-7 shrink-0 items-center justify-center rounded-full bg-cream-200 text-ink-800 transition-colors group-data-[state=checked]:bg-sage-800 group-data-[state=checked]:text-cream-50 [&_svg]:size-3.5"
                >
                  {option.icon}
                  <span className="absolute -top-1 -right-1 flex size-3.5 scale-50 items-center justify-center rounded-full bg-sage-800 opacity-0 ring-2 ring-white transition-[opacity,scale] duration-150 group-data-[state=checked]:scale-100 group-data-[state=checked]:opacity-100 motion-reduce:transition-none">
                    <Check strokeWidth={3.5} className="size-2 text-white" />
                  </span>
                </span>
              ) : null}
              <span className="flex min-w-0 flex-1">{text}</span>
              {!option.icon && (
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full border border-line-field/60 bg-white transition-colors group-data-[state=checked]:border-sage-800 group-data-[state=checked]:bg-sage-800"
                >
                  <Check
                    strokeWidth={3}
                    className="size-3 text-white opacity-0 transition-opacity group-data-[state=checked]:opacity-100"
                  />
                </span>
              )}
            </RadioGroup.Item>
          );
        })}
      </RadioGroup.Root>
    </div>
  );
}
