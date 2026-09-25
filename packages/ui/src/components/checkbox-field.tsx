"use client";

import type { ComponentProps } from "react";
import { useId } from "react";
import { Checkbox } from "./checkbox";

export function CheckboxField({
  label,
  hint,
  error,
  id,
  ...checkboxProps
}: {
  label: string;
  hint?: string;
  error?: string;
} & Omit<ComponentProps<typeof Checkbox>, "type">) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;
  const describedBy =
    [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <Checkbox
          id={controlId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...checkboxProps}
        />
        <label htmlFor={controlId} className="text-[15px] text-ink-900">
          {label}
        </label>
      </div>
      {hint && (
        <p id={hintId} className="text-[13px] text-ink-800">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[13px] text-danger-600">
          {error}
        </p>
      )}
    </div>
  );
}
