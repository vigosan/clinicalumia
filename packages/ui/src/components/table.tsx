import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto rounded-card bg-surface p-2">
      <table
        className={cn("w-full border-collapse text-sm", className)}
        {...props}
      />
    </div>
  );
}

export function TableHead(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}

export function TableBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}

export function TableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <tr
      className={cn("[&+&]:border-line [&+&]:border-t", className)}
      {...props}
    />
  );
}

export function TableHeaderCell({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-left text-[13px] font-medium text-ink-800",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: ComponentProps<"td">) {
  return (
    <td className={cn("px-4 py-3.5 text-ink-900", className)} {...props} />
  );
}
