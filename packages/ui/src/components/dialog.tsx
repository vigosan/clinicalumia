"use client";

import { X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import type { ComponentProps, ReactElement, ReactNode } from "react";

export function Dialog({
  trigger,
  title,
  description,
  open,
  onOpenChange,
  onOpenAutoFocus,
  onCloseAutoFocus,
  children,
  ...props
}: {
  trigger: ReactElement;
  title: string;
  description: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenAutoFocus?: ComponentProps<typeof Primitive.Content>["onOpenAutoFocus"];
  onCloseAutoFocus?: ComponentProps<
    typeof Primitive.Content
  >["onCloseAutoFocus"];
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-50 bg-ink-900/35 backdrop-blur-[2px] data-[state=open]:animate-fade-in motion-reduce:animate-none" />
        <Primitive.Content
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(34rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-card border border-line bg-surface p-4 shadow-[0_24px_64px_-24px_rgb(58_58_58/0.35)] data-[state=open]:animate-pop-in motion-reduce:animate-none sm:p-6"
          {...props}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Primitive.Title className="text-lg font-bold text-ink-900">
                {title}
              </Primitive.Title>
              <Primitive.Description className="text-[15px] text-ink-800">
                {description}
              </Primitive.Description>
            </div>
            <Primitive.Close
              aria-label="Cerrar"
              className="-mt-1 -mr-2 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-700 hover:bg-sage-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-sage-800"
            >
              <X aria-hidden="true" className="size-5" />
            </Primitive.Close>
          </div>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
