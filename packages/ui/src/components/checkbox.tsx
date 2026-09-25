import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Checkbox({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  return (
    <input
      type="checkbox"
      className={cn("size-[18px] shrink-0 accent-sage-800", className)}
      {...props}
    />
  );
}
