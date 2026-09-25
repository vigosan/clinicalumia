import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage-800 disabled:cursor-not-allowed disabled:opacity-60",
  {
    variants: {
      variant: {
        primary:
          "border-sage-800 bg-sage-800 text-cream-50 hover:border-sage-900 hover:bg-sage-900",
        secondary:
          "border-sage-800 bg-transparent text-sage-800 hover:bg-sage-100",
        ghost:
          "border-transparent bg-transparent text-sage-800 underline underline-offset-4 hover:text-sage-900",
        danger:
          "border-danger-600 bg-transparent text-danger-600 hover:bg-danger-100",
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
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
