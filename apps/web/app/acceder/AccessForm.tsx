"use client";

import { useActionState, useState } from "react";
import { PageHero } from "@/components/PageHero";
import { Turnstile } from "@/components/Turnstile";
import { type AccessState, requestAccess } from "./actions";

const initialState: AccessState = undefined;

const fieldClass =
  "rounded-2xl border border-sage-400/60 bg-cream-50 px-4 py-3 text-base text-ink-700 outline-none focus:border-sage-600";

export function AccessForm({
  next,
  caducado,
  turnstileSiteKey,
}: {
  next?: string;
  caducado?: string;
  turnstileSiteKey?: string;
}) {
  const [state, formAction, pending] = useActionState(
    requestAccess,
    initialState,
  );
  const [submits, setSubmits] = useState(0);

  return (
    <>
      <PageHero />
      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-md">
          <h1 className="font-bold text-ink-600 text-section">¿Quién eres?</h1>
          <p className="mt-3 mb-8 text-ink-500">
            Escribe tu email y te enviaremos un enlace y un código para entrar.
          </p>

          {caducado && (
            <p
              role="alert"
              data-testid="access-link-expired"
              className="mb-6 rounded-2xl bg-cream-100 px-4 py-3 text-ink-600 text-sm"
            >
              El enlace ha caducado o ya se usó. Pide uno nuevo.
            </p>
          )}

          <form
            action={formAction}
            onSubmit={() => setSubmits((count) => count + 1)}
            className="flex flex-col gap-4"
          >
            <input type="hidden" name="next" value={next ?? ""} />
            <label className="flex flex-col gap-1.5">
              <span className="text-ink-600 text-sm">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                data-testid="access-email"
                className={fieldClass}
              />
            </label>

            {turnstileSiteKey && (
              <Turnstile key={submits} siteKey={turnstileSiteKey} />
            )}

            {state?.error && (
              <p
                role="alert"
                data-testid="access-error"
                className="text-red-700 text-sm"
              >
                {state.error}
              </p>
            )}

            <button
              type="submit"
              disabled={pending}
              data-testid="access-submit"
              className="mt-2 cursor-pointer self-start rounded-full bg-sage-600 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Enviando…" : "Enviarme el acceso"}
            </button>
          </form>
        </div>
      </section>
    </>
  );
}
