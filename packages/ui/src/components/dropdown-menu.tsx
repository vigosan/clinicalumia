"use client";

import { DropdownMenu as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof Primitive.Content>) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-56 origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-xl border border-line bg-surface p-1.5 text-ink-900 shadow-[0_12px_32px_-12px_rgb(58_58_58/0.25)] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out motion-safe:data-[state=open]:animate-pop-in motion-safe:data-[state=closed]:animate-pop-out",
          className,
        )}
        {...props}
      />
    </Primitive.Portal>
  );
}

export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof Primitive.Item>) {
  return (
    <Primitive.Item
      className={cn(
        "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[15px] text-ink-900 outline-none transition-colors data-[highlighted]:bg-sage-100 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-text-tertiary",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className,
  ...props
}: ComponentProps<typeof Primitive.Label>) {
  return (
    <Primitive.Label
      className={cn("flex flex-col px-3 py-2", className)}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof Primitive.Separator>) {
  return (
    <Primitive.Separator
      className={cn("-mx-1.5 my-1.5 h-px bg-separator", className)}
      {...props}
    />
  );
}
