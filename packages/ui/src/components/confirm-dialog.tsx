"use client";

import { AlertDialog } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { Button } from "./button";
import { overlayClass } from "./dialog";

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  confirmTestId = "confirm-action",
  open,
  onOpenChange,
  closeOnConfirm = true,
  confirmDisabled = false,
  tone = "default",
  children,
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  confirmTestId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  closeOnConfirm?: boolean;
  confirmDisabled?: boolean;
  tone?: "default" | "destructive";
  children?: ReactNode;
  onConfirm: () => void;
}) {
  const confirmVariant = tone === "destructive" ? "destructive" : "primary";
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayClass} />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[min(30rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-[0_24px_64px_-24px_rgb(58_58_58/0.35)] data-[state=open]:animate-pop-in motion-reduce:animate-none">
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="text-lg font-bold text-ink-900">
              {title}
            </AlertDialog.Title>
            <AlertDialog.Description className="text-[15px] text-ink-800">
              {description}
            </AlertDialog.Description>
          </div>
          {children}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" size="sm">
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            {closeOnConfirm ? (
              <AlertDialog.Action asChild>
                <Button
                  variant={confirmVariant}
                  size="sm"
                  data-testid={confirmTestId}
                  disabled={confirmDisabled}
                  onClick={onConfirm}
                >
                  {confirmLabel}
                </Button>
              </AlertDialog.Action>
            ) : (
              <Button
                type="button"
                variant={confirmVariant}
                size="sm"
                data-testid={confirmTestId}
                disabled={confirmDisabled}
                onClick={onConfirm}
              >
                {confirmLabel}
              </Button>
            )}
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
