import { Check } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Checkbox({
  className,
  ...props
}: Omit<ComponentProps<"input">, "type">) {
  return (
    <span className="relative inline-flex size-[18px] shrink-0">
      <input
        type="checkbox"
        className={cn(
          "peer size-full cursor-pointer appearance-none rounded-[5px] border border-line-field bg-white shadow-[0_1px_2px_rgb(58_58_58/0.05)] transition-colors checked:border-sage-800 checked:bg-sage-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-800 disabled:cursor-not-allowed disabled:opacity-55 aria-[invalid=true]:border-danger-600",
          className,
        )}
        {...props}
      />
      <Check
        aria-hidden="true"
        strokeWidth={3}
        className="pointer-events-none absolute inset-0 m-auto size-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
      />
    </span>
  );
}
