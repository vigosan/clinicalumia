"use client";

import { cloneElement, type ReactElement, useId } from "react";
import { Label } from "./label";

type ControlProps = {
  id?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactElement<ControlProps>;
}) {
  const generatedId = useId();
  const controlId = children.props.id ?? generatedId;
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;
  const describedBy =
    [children.props["aria-describedby"], hint && hintId, error && errorId]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={controlId}>{label}</Label>
      {cloneElement(children, {
        id: controlId,
        "aria-invalid": error ? true : children.props["aria-invalid"],
        "aria-describedby": describedBy,
      })}
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
