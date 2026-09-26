import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { fieldControl } from "./input";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(fieldControl, "h-auto min-h-24 py-2.5", className)}
      {...props}
    />
  );
}
