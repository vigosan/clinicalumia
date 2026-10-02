"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Drawer } from "vaul";
import { type CollaboratorFormState, sendCollaboratorRequest } from "./actions";

const initialState: CollaboratorFormState = undefined;
const DESKTOP_QUERY = "(min-width: 768px)";

function subscribeDesktop(callback: () => void): () => void {
  const mq = window.matchMedia(DESKTOP_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getDesktopSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getDesktopServerSnapshot(): boolean {
  return false;
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    getDesktopSnapshot,
    getDesktopServerSnapshot,
  );
}

export function CollaboratorDrawer() {
  const isDesktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    sendCollaboratorRequest,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <Drawer.Root
      open={open}
      onOpenChange={setOpen}
      direction={isDesktop ? "right" : "bottom"}
    >
      <Drawer.Trigger
        data-testid="collaborator-trigger"
        className="inline-flex cursor-pointer items-center justify-center rounded-full border border-cream-50/80 bg-transparent px-8 py-3 text-base text-cream-50 transition hover:bg-cream-50/10 md:px-10 md:text-lg"
      >
        Quiero ser colaborador/a
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-stone-900/40" />
        <Drawer.Content
          data-testid="collaborator-drawer"
          className={
            isDesktop
              ? "fixed right-0 top-0 bottom-0 z-50 flex h-full w-full max-w-md flex-col bg-cream-50 outline-none"
              : "fixed bottom-0 left-0 right-0 z-50 mt-24 flex max-h-[92vh] flex-col rounded-t-2xl bg-cream-50 outline-none"
          }
        >
          {!isDesktop && (
            <div
              aria-hidden
              className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-stone-300"
            />
          )}

          <div className="flex flex-col gap-2 px-6 pt-6 pb-2 md:px-8 md:pt-10">
            <Drawer.Title className="font-display text-2xl font-light text-stone-900 md:text-3xl">
              Quiero ser colaborador/a
            </Drawer.Title>
            <Drawer.Description className="text-sm text-stone-600">
              Déjanos tus datos y te escribiremos pronto.
            </Drawer.Description>
          </div>

          {state && "ok" in state && state.ok ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center md:px-8">
              <p
                className="text-lg text-stone-800"
                data-testid="collaborator-success"
              >
                ¡Gracias! Hemos recibido tu mensaje.
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-full bg-sage-700 px-6 py-2.5 text-sm font-medium text-cream-50 transition hover:bg-sage-800"
              >
                Cerrar
              </button>
            </div>
          ) : (
            <form
              ref={formRef}
              action={formAction}
              data-testid="collaborator-form"
              className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pb-8 pt-4 md:px-8"
            >
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-stone-700">Especialidad</span>
                <input
                  type="text"
                  name="specialty"
                  required
                  autoComplete="off"
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-sage-700"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-stone-700">Teléfono</span>
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-sage-700"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-stone-700">Correo electrónico</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-sage-700"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-stone-700">Mensaje</span>
                <textarea
                  name="message"
                  rows={4}
                  className="resize-none rounded-md border border-stone-300 bg-white px-3 py-2 text-base outline-none focus:border-sage-700"
                />
              </label>

              {state && "error" in state && (
                <p
                  className="text-sm text-red-600"
                  role="alert"
                  data-testid="collaborator-error"
                >
                  {state.error}
                </p>
              )}

              <div className="mt-auto flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={pending}
                  data-testid="collaborator-submit"
                  className="cursor-pointer rounded-full bg-sage-700 px-6 py-3 text-sm font-medium text-cream-50 transition hover:bg-sage-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending ? "Enviando…" : "Enviar"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="cursor-pointer rounded-full px-6 py-2 text-sm text-stone-600 transition hover:bg-stone-100"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
