import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
  {
    variants: {
      tone: {
        success: "bg-sage-100 text-sage-900",
        warning: "bg-warning-100 text-warning-800",
        bark: "bg-bark-100 text-bark-700",
        neutral: "bg-stone-200 text-stone-700",
        outline: "border border-stone-400 text-stone-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
