import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div className={cn("rounded-card bg-surface p-6", className)} {...props} />
  );
}
