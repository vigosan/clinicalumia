import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const rowLinkClass =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-field focus-visible:after:outline-2 focus-visible:after:outline-sage-800";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-card bg-surface p-2 max-md:bg-transparent max-md:p-0">
      <table
        className={cn("w-full border-collapse text-sm max-md:block", className)}
        {...props}
      />
    </div>
  );
}

export function TableHead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("max-md:sr-only", className)} {...props} />;
}

export function TableBody({ className, ...props }: ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("max-md:flex max-md:flex-col max-md:gap-2", className)}
      {...props}
    />
  );
}

export function TableRow({
  className,
  linked,
  ...props
}: ComponentProps<"tr"> & { linked?: boolean }) {
  return (
    <tr
      className={cn(
        linked && "relative transition-colors hover:bg-cream-50",
        "[&+&]:border-line [&+&]:border-t max-md:flex max-md:flex-col max-md:gap-1 max-md:rounded-card max-md:bg-surface max-md:px-5 max-md:py-4 max-md:[&+&]:border-t-0",
        className,
      )}
      {...props}
    />
  );
}

export function TableHeaderCell({
  className,
  numeric,
  ...props
}: ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-[13px] font-medium text-ink-800",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  label,
  numeric,
  ...props
}: ComponentProps<"td"> & { label?: string; numeric?: boolean }) {
  return (
    <td
      data-label={label}
      className={cn(
        "px-4 py-3.5 text-ink-900 max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-4 max-md:p-0 max-md:text-right max-md:empty:hidden max-md:data-label:before:shrink-0 max-md:data-label:before:font-normal max-md:data-label:before:text-[13px] max-md:data-label:before:text-ink-800 max-md:data-label:before:content-[attr(data-label)]",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
