"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import { Toast as Primitive } from "radix-ui";
import { useEffect, useSyncExternalStore } from "react";

type ToastAction = { label: string; onClick: () => void };

type ToastOptions = { tone?: "success" | "error"; action?: ToastAction };

type ToastItem = {
  id: number;
  message: string;
  tone: "success" | "error";
  action?: ToastAction;
  open: boolean;
};

const ERROR_DURATION = 8000;

const NO_TOASTS: ToastItem[] = [];
let toasts: ToastItem[] = NO_TOASTS;
let nextId = 0;
const listeners = new Set<() => void>();

function setToasts(next: ToastItem[]) {
  toasts = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function toast(
  message: string,
  { tone = "success", action }: ToastOptions = {},
) {
  if (typeof window === "undefined") return;
  nextId += 1;
  setToasts([
    ...toasts.filter((item) => item.open),
    { id: nextId, message, tone, action, open: true },
  ]);
}

function dismiss(id: number) {
  setToasts(
    toasts.map((item) => (item.id === id ? { ...item, open: false } : item)),
  );
}

export function Toaster({ duration = 5000 }: { duration?: number }) {
  const items = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => NO_TOASTS,
  );

  useEffect(() => () => setToasts(NO_TOASTS), []);

  return (
    <Primitive.Provider
      duration={duration}
      label="Aviso"
      swipeDirection="right"
    >
      {items.map((item) => (
        <Primitive.Root
          key={item.id}
          data-testid="toast"
          data-tone={item.tone}
          open={item.open}
          type={item.tone === "error" ? "foreground" : "background"}
          duration={
            item.action
              ? Number.POSITIVE_INFINITY
              : item.tone === "error"
                ? Math.max(duration, ERROR_DURATION)
                : undefined
          }
          onOpenChange={(open) => {
            if (!open) dismiss(item.id);
          }}
          className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-surface py-3 pr-2 pl-4 text-[15px] text-ink-900 shadow-[0_12px_32px_-12px_rgb(58_58_58/0.35)] data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out motion-safe:data-[state=open]:animate-toast-in motion-safe:data-[state=closed]:animate-toast-out data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=end]:translate-x-(--radix-toast-swipe-end-x)"
        >
          {item.tone === "error" ? (
            <CircleAlert
              aria-hidden="true"
              data-testid="toast-icon"
              className="mt-0.5 size-5 shrink-0 text-danger-600"
            />
          ) : (
            <CircleCheck
              aria-hidden="true"
              data-testid="toast-icon"
              className="mt-0.5 size-5 shrink-0 text-sage-800"
            />
          )}
          <Primitive.Description className="flex-1 pt-px">
            {item.message}
          </Primitive.Description>
          {item.action && (
            <Primitive.Action
              altText={item.action.label}
              onClick={item.action.onClick}
              className="-my-0.5 shrink-0 cursor-pointer rounded-full px-3 py-1 font-medium text-[15px] text-sage-900 hover:bg-sage-100 focus-visible:outline-2 focus-visible:outline-sage-800"
            >
              {item.action.label}
            </Primitive.Action>
          )}
          <Primitive.Close
            aria-label="Cerrar aviso"
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-text-tertiary hover:bg-sage-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-sage-800"
          >
            <X aria-hidden="true" className="size-4" />
          </Primitive.Close>
        </Primitive.Root>
      ))}
      <Primitive.Viewport
        label="Avisos ({hotkey})"
        className="fixed right-0 bottom-0 left-0 pointer-events-none z-[60] m-0 flex list-none flex-col gap-2 p-4 outline-none sm:left-auto sm:w-[26rem] sm:p-6"
      />
    </Primitive.Provider>
  );
}
