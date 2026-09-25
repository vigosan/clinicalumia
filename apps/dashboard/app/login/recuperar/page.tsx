"use client";

import { startTransition, useActionState } from "react";
import { type RecoverState, requestRecovery } from "./actions";

const initialState: RecoverState = undefined;

export default function RecoverPage() {
  const [state, formAction, pending] = useActionState(
    requestRecovery,
    initialState,
  );

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      {state && "sent" in state ? (
        <p
          data-testid="recover-sent"
          className="max-w-sm text-center text-slate-700"
        >
          Si el email tiene cuenta, te hemos enviado un enlace para cambiar la
          contraseña.
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => formAction(formData));
          }}
          className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <h1 className="text-center text-2xl font-semibold text-slate-900">
            Recuperar contraseña
          </h1>
          <label className="block space-y-1 text-sm">
            <span className="text-slate-700">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              data-testid="recover-email"
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
            />
          </label>
          {state && "error" in state && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            data-testid="recover-submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {pending ? "Enviando…" : "Enviarme el enlace"}
          </button>
        </form>
      )}
    </main>
  );
}
