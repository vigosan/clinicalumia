"use client";

import { Tabs as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const Tabs = Primitive.Root;

export function TabsList({
  className,
  ...props
}: ComponentProps<typeof Primitive.List>) {
  return (
    <Primitive.List
      className={cn("flex gap-6 border-line border-b", className)}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof Primitive.Trigger>) {
  return (
    <Primitive.Trigger
      className={cn(
        "-mb-px inline-flex cursor-pointer items-center gap-2 border-transparent border-b-2 pt-1 pb-3 font-medium text-[15px] text-ink-800 transition-colors hover:text-ink-900 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-sage-800 data-[state=active]:border-sage-800 data-[state=active]:text-ink-900",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Content
      className={cn("pt-5 outline-none", className)}
      {...props}
    />
  );
}
