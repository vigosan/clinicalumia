import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const fieldControl =
  "h-11 w-full rounded-field border border-line-strong bg-white px-3.5 text-[15px] text-ink-900 outline-none transition-colors placeholder:text-ink-500 focus:border-sage-800 aria-[invalid=true]:border-danger-600";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldControl, className)} {...props} />;
}
