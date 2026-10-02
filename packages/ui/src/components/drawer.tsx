"use client";

import { X } from "lucide-react";
import { Dialog as Primitive } from "radix-ui";
import {
  type ComponentProps,
  type ReactElement,
  type ReactNode,
  useSyncExternalStore,
} from "react";
import { cn } from "../lib/cn";
import { closeButtonClass, overlayClass } from "./dialog";

type ContentProps = ComponentProps<typeof Primitive.Content>;

export const DrawerClose = Primitive.Close;

function subscribeToNothing() {
  return () => {};
}

function useHydrated() {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

export function Drawer({
  trigger,
  open,
  onOpenChange,
  onOpenAutoFocus,
  onCloseAutoFocus,
  title,
  description,
  actions,
  prominent = false,
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
  actions?: ReactNode;
  prominent?: boolean;
  children: ReactNode;
  "data-testid"?: string;
}) {
  const hydrated = useHydrated();
  const descriptionElement = (
    <Primitive.Description className="text-[13px] text-ink-800">
      {description}
    </Primitive.Description>
  );
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && (
        <Primitive.Trigger asChild disabled={!hydrated}>
          {trigger}
        </Primitive.Trigger>
      )}
      <Primitive.Portal>
        <Primitive.Overlay
          data-testid="drawer-overlay"
          className={cn(overlayClass, "sm:bg-ink-900/20 sm:backdrop-blur-none")}
        />
        <Primitive.Content
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed inset-x-0 bottom-0 z-50 flex h-[92dvh] flex-col gap-5 overflow-y-auto rounded-t-[20px] border-line border-t bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_-16px_rgb(58_58_58/0.3)] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out motion-safe:data-[state=open]:animate-slide-in-bottom motion-safe:data-[state=closed]:animate-slide-out-bottom sm:top-0 sm:left-auto sm:h-auto sm:w-[440px] sm:rounded-none sm:border-t-0 sm:border-l sm:px-7 sm:py-6 sm:shadow-[-8px_0_32px_-16px_rgb(58_58_58/0.3)] sm:motion-safe:data-[state=open]:animate-slide-in-right sm:motion-safe:data-[state=closed]:animate-slide-out-right"
          {...props}
        >
          <div
            aria-hidden="true"
            data-testid="drawer-grabber"
            className="mx-auto -my-2 h-[5px] w-9 shrink-0 rounded-full bg-line sm:hidden"
          />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              {!prominent && descriptionElement}
              <Primitive.Title
                className={cn(
                  "font-bold text-ink-900",
                  prominent ? "text-[22px] leading-tight" : "text-lg",
                )}
              >
                {title}
              </Primitive.Title>
              {prominent && descriptionElement}
            </div>
            <div className="-mt-1 -mr-2 flex shrink-0 items-center gap-1">
              {actions}
              <Primitive.Close aria-label="Cerrar" className={closeButtonClass}>
                <X aria-hidden="true" className="size-5" />
              </Primitive.Close>
            </div>
          </div>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  );
}
