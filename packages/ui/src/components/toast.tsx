"use client";

import { CircleCheck, X } from "lucide-react";
import { Toast as Primitive } from "radix-ui";
import { useEffect, useSyncExternalStore } from "react";

type ToastItem = { id: number; message: string };

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

export function toast(message: string) {
  nextId += 1;
  setToasts([...toasts, { id: nextId, message }]);
}

function dismiss(id: number) {
  setToasts(toasts.filter((item) => item.id !== id));
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
          type="background"
          onOpenChange={(open) => {
            if (!open) dismiss(item.id);
          }}
          className="flex items-start gap-3 rounded-xl border border-line bg-surface py-3 pr-2 pl-4 text-[15px] text-ink-900 shadow-[0_12px_32px_-12px_rgb(58_58_58/0.35)] data-[state=open]:animate-pop-in data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) motion-reduce:animate-none"
        >
          <CircleCheck
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-sage-800"
          />
          <Primitive.Description className="flex-1 pt-px">
            {item.message}
          </Primitive.Description>
          <Primitive.Close
            aria-label="Cerrar aviso"
            className="inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-700 hover:bg-sage-100 hover:text-ink-900 focus-visible:outline-2 focus-visible:outline-sage-800"
          >
            <X aria-hidden="true" className="size-4" />
          </Primitive.Close>
        </Primitive.Root>
      ))}
      <Primitive.Viewport className="fixed right-0 bottom-0 left-0 z-[60] m-0 flex list-none flex-col gap-2 p-4 outline-none sm:left-auto sm:w-[26rem] sm:p-6" />
    </Primitive.Provider>
  );
}
