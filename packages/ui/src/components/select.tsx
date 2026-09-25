import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { fieldControl } from "./input";

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(fieldControl, "pr-9", className)} {...props} />;
}
