import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Label({
  className,
  htmlFor,
  children,
  ...props
}: ComponentProps<"label">) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn("text-[13px] font-medium text-ink-800", className)}
      {...props}
    >
      {children}
    </label>
  );
}
