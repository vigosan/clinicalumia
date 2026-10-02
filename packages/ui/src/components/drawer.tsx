"use client";

import { X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { cn } from "../lib/cn";
import { closeButtonClass, overlayClass } from "./dialog";

type ContentProps = ComponentProps<typeof Primitive.Content>;

export const DrawerClose = Primitive.Close;

export function Drawer({
  trigger,
  open,
  onOpenChange,
  onOpenAutoFocus,
  onCloseAutoFocus,
  title,
  description,
  children,
  ...props
}: {
  trigger?: ReactElement;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenAutoFocus?: ContentProps["onOpenAutoFocus"];
  onCloseAutoFocus?: ContentProps["onCloseAutoFocus"];
  title: ReactNode;
  description: ReactNode;
  children: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>}
      <Primitive.Portal>
        <Primitive.Overlay className={overlayClass} />
        <Primitive.Content
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col gap-5 overflow-y-auto rounded-t-card border-line border-t bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_-16px_rgb(58_58_58/0.3)] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out motion-safe:data-[state=open]:animate-slide-in-bottom motion-safe:data-[state=closed]:animate-slide-out-bottom sm:top-0 sm:left-auto sm:max-h-none sm:w-[26rem] sm:rounded-none sm:border-t-0 sm:border-l sm:p-6 sm:shadow-[-8px_0_32px_-16px_rgb(58_58_58/0.3)] sm:motion-safe:data-[state=open]:animate-slide-in-right sm:motion-safe:data-[state=closed]:animate-slide-out-right"
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
