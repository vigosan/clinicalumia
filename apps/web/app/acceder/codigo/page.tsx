"use client";

import { use, useActionState } from "react";
import { type AccessState, verifyCode } from "../actions";

const initialState: AccessState = undefined;

const fieldClass =
  "rounded-2xl border border-sage-400/60 bg-cream-50 px-4 py-3 text-base text-ink-700 outline-none focus:border-sage-600";

export default function CodigoPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>;
}) {
  const { email, next } = use(searchParams);
  const [state, formAction, pending] = useActionState(verifyCode, initialState);

  return (
    <section className="px-6 py-14 md:px-12 md:py-20">
      <div className="mx-auto max-w-md">
        <h1 className="font-bold text-ink-600 text-section">Revisa tu email</h1>
        <p data-testid="access-sent" className="mt-3 mb-8 text-ink-500">
          Te hemos enviado un enlace y un código a {email}. Pulsa el enlace o
          escribe aquí el código.
        </p>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={email ?? ""} />
          <input type="hidden" name="next" value={next ?? "/"} />
          <label className="flex flex-col gap-1.5">
            <span className="text-ink-600 text-sm">Código</span>
            <input
              type="text"
              name="code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              data-testid="access-code"
              className={fieldClass}
            />
          </label>

          {state?.error && (
            <p
              role="alert"
              data-testid="access-code-error"
              className="text-red-700 text-sm"
            >
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            data-testid="access-code-submit"
            className="mt-2 cursor-pointer self-start rounded-full bg-sage-600 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Comprobando…" : "Entrar"}
          </button>
        </form>
      </div>
    </section>
  );
}
