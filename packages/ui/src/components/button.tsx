import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const buttonVariants = cva(
  "inline-flex cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border font-medium transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-800 disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "border-sage-800 bg-sage-800 text-cream-50 shadow-[0_1px_2px_rgb(63_69_53/0.18)] hover:border-sage-900 hover:bg-sage-900",
        secondary:
          "border-line-field/45 bg-white text-ink-900 shadow-[0_1px_2px_rgb(58_58_58/0.06)] hover:border-line-field/70 hover:bg-cream-50",
        ghost:
          "border-transparent bg-transparent text-ink-900 hover:bg-sage-100 data-[state=open]:bg-sage-100",
        danger:
          "border-danger-600/35 bg-white text-danger-600 shadow-[0_1px_2px_rgb(58_58_58/0.06)] hover:border-danger-600/60 hover:bg-danger-100",
        destructive:
          "border-danger-600 bg-danger-600 text-white shadow-[0_1px_2px_rgb(156_74_49/0.25)] hover:border-[#843d28] hover:bg-[#843d28] focus-visible:outline-danger-600",
      },
      size: {
        md: "h-11 px-[22px] text-[15px]",
        sm: "h-9 px-4 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : "button";
  return (
    <Component
      data-variant={variant ?? "primary"}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
