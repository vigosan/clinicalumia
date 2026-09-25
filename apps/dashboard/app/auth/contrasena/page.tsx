"use client";

import { startTransition, useActionState } from "react";
import { type PasswordState, setPassword } from "./actions";

const initialState: PasswordState = undefined;

export default function SetPasswordPage() {
  const [state, formAction, pending] = useActionState(
    setPassword,
    initialState,
  );

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <form
        data-testid="password-form"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-center text-2xl font-semibold text-slate-900">
          Elige tu contraseña
        </h1>
        <label className="block space-y-1 text-sm">
          <span className="text-slate-700">
            Contraseña (mínimo 12 caracteres)
          </span>
          <input
            type="password"
            name="password"
            required
            autoComplete="new-password"
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-slate-700">Repite la contraseña</span>
          <input
            type="password"
            name="confirmation"
            required
            autoComplete="new-password"
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2"
          />
        </label>
        {state?.error && (
          <p
            role="alert"
            data-testid="password-error"
            className="text-sm text-red-600"
          >
            {state.error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          data-testid="password-submit"
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar y entrar"}
        </button>
      </form>
    </main>
  );
}
