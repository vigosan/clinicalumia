"use client";

import { useActionState } from "react";
import { type LoginState, login } from "./actions";

const initialState: LoginState = undefined;

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Clínica Lumia · Admin
          </h1>
          <p className="text-sm text-slate-500">Acceso restringido</p>
        </div>

        <div className="space-y-4">
          <label className="block space-y-1 text-sm">
            <span className="text-slate-700">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="text-slate-700">Contraseña</span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-slate-500"
            />
          </label>
        </div>

        {state?.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          data-testid="login-submit"
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}
