"use client";

import { X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/cn";
import { closeButtonClass, overlayClass } from "./dialog";

export function Sheet({
  open,
  onOpenChange,
  onCloseAutoFocus,
  title,
  description,
  children,
  ...props
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: ComponentProps<
    typeof Primitive.Content
  >["onCloseAutoFocus"];
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className={overlayClass} />
        <Primitive.Content
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col gap-5 overflow-y-auto bg-surface p-5 shadow-[-8px_0_32px_-16px_rgb(58_58_58/0.3)] data-[state=open]:animate-slide-in-right motion-reduce:animate-none sm:w-[26rem] sm:border-line sm:border-l sm:p-6"
          {...props}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Primitive.Description className="text-[13px] text-ink-800">
                {description}
              </Primitive.Description>
              <Primitive.Title className="text-lg font-bold text-ink-900">
                {title}
              </Primitive.Title>
            </div>
            <Primitive.Close
              aria-label="Cerrar"
              className={cn("-mt-1 -mr-2", closeButtonClass)}
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
