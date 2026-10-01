"use client";

import { Switch as Primitive } from "radix-ui";
import { type ComponentProps, useId } from "react";
import { cn } from "../lib/cn";

export function Switch({
  className,
  ...props
}: ComponentProps<typeof Primitive.Root>) {
  return (
    <Primitive.Root
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full bg-pebble-400 p-0.5 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-800 disabled:cursor-not-allowed disabled:opacity-55 data-[state=checked]:bg-sage-800",
        className,
      )}
      {...props}
    >
      <Primitive.Thumb className="block size-5 rounded-full bg-white shadow-[0_1px_3px_rgb(58_58_58/0.3)] transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-[state=checked]:translate-x-5 motion-reduce:transition-none" />
    </Primitive.Root>
  );
}

export function SwitchField({
  label,
  hint,
  id,
  ...switchProps
}: {
  label: string;
  hint?: string;
} & ComponentProps<typeof Primitive.Root>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${generatedId}-hint`;

  return (
    <div className="flex items-start gap-3">
      <Switch
        {...switchProps}
        id={controlId}
        aria-describedby={hint ? hintId : undefined}
      />
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={controlId}
          className="cursor-pointer text-[15px] text-ink-900 leading-6"
        >
          {label}
        </label>
        {hint && (
          <p id={hintId} className="text-[13px] text-ink-800">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}
