import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const rowLinkClass =
  "after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-field focus-visible:after:outline-2 focus-visible:after:outline-sage-800";

type MobileRole = "primary" | "trailing" | "secondary" | "action" | "hidden";

const mobileRoleClass: Record<MobileRole, string> = {
  primary:
    "max-md:order-1 max-md:min-w-px max-md:flex-1 max-md:font-medium max-md:text-[15px]",
  trailing: "max-md:order-2 max-md:text-[15px] max-md:tabular-nums",
  action: "max-md:order-2 max-md:ml-2 max-md:self-center",
  secondary:
    "max-md:order-4 max-md:text-[13px] max-md:text-ink-700 max-md:before:mx-1.5 max-md:before:content-['·'] max-md:[&:nth-child(1_of_[data-mobile=secondary])]:before:content-none",
  hidden: "max-md:hidden",
};

export function Table({
  className,
  variant = "cards",
  ...props
}: ComponentProps<"table"> & { variant?: "cards" | "list" }) {
  return (
    <div
      data-variant={variant}
      className={cn(
        "group/table overflow-x-auto rounded-card bg-surface p-2",
        variant === "cards" && "max-md:bg-transparent max-md:p-0",
        variant === "list" && "max-md:p-0",
      )}
    >
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
      className={cn(
        "max-md:flex max-md:flex-col max-md:gap-2 max-md:group-data-[variant=list]/table:gap-0",
        className,
      )}
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
        "max-md:group-data-[variant=list]/table:flex-row max-md:group-data-[variant=list]/table:flex-wrap max-md:group-data-[variant=list]/table:items-baseline max-md:group-data-[variant=list]/table:gap-x-0 max-md:group-data-[variant=list]/table:gap-y-0.5 max-md:group-data-[variant=list]/table:rounded-none max-md:group-data-[variant=list]/table:bg-transparent max-md:group-data-[variant=list]/table:px-4 max-md:group-data-[variant=list]/table:py-3 max-md:group-data-[variant=list]/table:[&+&]:border-t max-md:group-data-[variant=list]/table:after:order-3 max-md:group-data-[variant=list]/table:after:basis-full max-md:group-data-[variant=list]/table:after:content-['']",
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
  mobile,
  ...props
}: ComponentProps<"td"> & {
  label?: string;
  numeric?: boolean;
  mobile?: MobileRole;
}) {
  return (
    <td
      data-label={mobile ? undefined : label}
      data-mobile={mobile}
      className={cn(
        "px-4 py-3.5 text-ink-900",
        mobile
          ? cn("max-md:p-0", mobileRoleClass[mobile])
          : "max-md:flex max-md:items-baseline max-md:justify-between max-md:gap-4 max-md:p-0 max-md:text-right max-md:empty:hidden max-md:data-label:before:shrink-0 max-md:data-label:before:font-normal max-md:data-label:before:text-[13px] max-md:data-label:before:text-ink-800 max-md:data-label:before:content-[attr(data-label)]",
        numeric && "text-right tabular-nums",
        className,
      )}
      {...props}
    />
  );
}
