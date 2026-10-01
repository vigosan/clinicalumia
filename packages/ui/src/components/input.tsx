import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const fieldControl =
  "h-11 w-full rounded-field border border-line-field bg-white px-3.5 text-[15px] text-ink-900 outline-none transition-colors placeholder:text-ink-500 focus:border-sage-800 focus:ring-[3px] focus:ring-sage-800/15 aria-[invalid=true]:border-danger-600 aria-[invalid=true]:focus:ring-danger-600/15 disabled:cursor-not-allowed disabled:opacity-60";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldControl, className)} {...props} />;
}
