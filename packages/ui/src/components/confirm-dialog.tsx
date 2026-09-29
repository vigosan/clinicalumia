"use client";

import { AlertDialog } from "radix-ui";
import type { ReactElement, ReactNode } from "react";
import { Button } from "./button";

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
  children?: ReactNode;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink-900/30" />
        <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-card bg-surface p-6">
          <AlertDialog.Title className="text-xl font-bold text-ink-900">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="text-[15px] text-ink-800">
            {description}
          </AlertDialog.Description>
          {children}
          <div className="flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" size="sm">
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            {closeOnConfirm ? (
              <AlertDialog.Action asChild>
                <Button
                  variant="danger"
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
                variant="danger"
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
