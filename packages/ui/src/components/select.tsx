"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as Primitive } from "radix-ui";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { fieldControl } from "./input";

export type SelectOption = { value: string; label: string; disabled?: boolean };

const EMPTY = "__empty__";

function toItemValue(value: string) {
  return value === "" ? EMPTY : value;
}

function fromItemValue(value: string) {
  return value === EMPTY ? "" : value;
}

export function Select({
  options,
  value,
  defaultValue = "",
  onValueChange,
  name,
  placeholder,
  required,
  disabled,
  id,
  className,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  "data-testid": testId,
}: {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "data-testid"?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const current = value ?? uncontrolled;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootValue = options.some((option) => option.value === current)
    ? toItemValue(current)
    : "";

  useEffect(() => {
    const form = triggerRef.current?.form;
    if (!form) return;
    function handleReset() {
      setUncontrolled(defaultValue);
    }
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, [defaultValue]);

  return (
    <>
      <Primitive.Root
        value={rootValue}
        disabled={disabled}
        required={required}
        onValueChange={(next) => {
          const nextValue = fromItemValue(next);
          if (value === undefined) setUncontrolled(nextValue);
          onValueChange?.(nextValue);
        }}
      >
        <Primitive.Trigger
          ref={triggerRef}
          id={id}
          aria-label={ariaLabel}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          data-testid={testId}
          className={cn(
            fieldControl,
            "flex cursor-pointer items-center justify-between gap-2 text-left focus:border-line-field focus:ring-0 focus-visible:border-sage-800 focus-visible:ring-[3px] focus-visible:ring-sage-800/15 data-[placeholder]:text-ink-500 data-[state=open]:border-sage-800 data-[state=open]:ring-[3px] data-[state=open]:ring-sage-800/15 [&>span]:truncate",
            className,
          )}
        >
          <Primitive.Value placeholder={placeholder} />
          <Primitive.Icon asChild>
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 text-ink-700"
            />
          </Primitive.Icon>
        </Primitive.Trigger>
        <Primitive.Portal>
          <Primitive.Content
            position="popper"
            sideOffset={6}
            className="z-50 max-h-(--radix-select-content-available-height) min-w-(--radix-select-trigger-width) overflow-hidden rounded-xl border border-line bg-surface text-ink-900 shadow-[0_12px_32px_-12px_rgb(58_58_58/0.25)] data-[state=open]:animate-pop-in motion-reduce:animate-none"
          >
            <Primitive.Viewport className="p-1.5">
              {options.map((option) => (
                <Primitive.Item
                  key={option.value}
                  value={toItemValue(option.value)}
                  disabled={option.disabled}
                  data-testid={`option-${option.value}`}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-lg py-2 pr-9 pl-3 text-[15px] outline-none transition-colors data-[disabled]:cursor-not-allowed data-[highlighted]:bg-sage-100 data-[state=checked]:font-medium data-[disabled]:opacity-50"
                >
                  <Primitive.ItemText>{option.label}</Primitive.ItemText>
                  <Primitive.ItemIndicator className="absolute right-3 flex items-center">
                    <Check
                      aria-hidden="true"
                      strokeWidth={2.5}
                      className="size-4 text-sage-800"
                    />
                  </Primitive.ItemIndicator>
                </Primitive.Item>
              ))}
            </Primitive.Viewport>
          </Primitive.Content>
        </Primitive.Portal>
      </Primitive.Root>
      {name && <input type="hidden" name={name} value={current} />}
    </>
  );
}
