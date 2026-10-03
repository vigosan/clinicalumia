"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PageHero } from "@/components/PageHero";
import { Turnstile } from "@/components/Turnstile";
import { type AccessState, requestAccess } from "./actions";

const initialState: AccessState = undefined;

const fieldClass =
  "min-h-12 rounded-2xl border border-sage-600 bg-white px-4 py-3 text-base text-ink-900 outline-none focus:border-sage-800 focus:ring-2 focus:ring-sage-800/25";

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
        <div className="mx-auto max-w-lg rounded-[2rem] bg-white p-8 md:p-12">
          <h1 className="font-bold text-[2.25rem] text-ink-900 leading-tight tracking-tight md:text-[2.75rem]">
            Accede a tu cuenta
          </h1>
          <p className="mt-3 mb-8 text-ink-800 text-lg">
            Escribe tu email y te enviaremos un enlace y un código para entrar.
            Sin contraseñas.
          </p>

          {caducado && (
            <p
              role="alert"
              data-testid="access-link-expired"
              className="mb-6 rounded-2xl bg-cream-100 px-4 py-3 text-ink-800 text-sm"
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
              <span className="font-medium text-ink-900 text-sm">Email</span>
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
              <Turnstile
                key={submits}
                siteKey={turnstileSiteKey}
                action="acceder"
              />
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
              className="mt-2 min-h-12 w-full cursor-pointer rounded-full bg-sage-800 px-8 py-3 font-medium text-cream-50 transition-colors hover:bg-sage-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Enviando…" : "Enviarme el acceso"}
            </button>
          </form>

          <p className="mt-8 border-cream-200 border-t pt-6 text-ink-800">
            Desde tu cuenta puedes ver, cambiar o cancelar tus citas. ¿Aún no
            eres paciente?{" "}
            <Link
              href="/reservar"
              className="font-medium text-sage-800 underline underline-offset-2"
            >
              Pide tu primera valoración
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
