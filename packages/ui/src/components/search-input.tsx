import { Search } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { fieldControl } from "./input";

export function SearchInput({
  className,
  "aria-label": ariaLabel,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { "aria-label": string }) {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-500"
      />
      <input
        type="search"
        aria-label={ariaLabel}
        className={cn(fieldControl, "pl-10", className)}
        {...props}
      />
    </div>
  );
}
