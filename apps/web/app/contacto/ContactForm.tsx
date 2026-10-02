"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { type ContactFormState, sendContactRequest } from "../actions";

const initialState: ContactFormState = undefined;

const fieldClass =
  "rounded-2xl border border-sage-400/60 bg-cream-50 px-4 py-3 text-base text-ink-700 outline-none focus:border-sage-600";

export function ContactForm() {
  const [state, formAction, pending] = useActionState(
    sendContactRequest,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  if (state && "ok" in state && state.ok) {
    return (
      <p
        data-testid="contact-success"
        className="rounded-panel bg-sage-500 px-8 py-12 text-center text-cream-50 text-lg"
      >
        ¡Gracias! Hemos recibido tu mensaje y te contactaremos para orientarte.
      </p>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      data-testid="contact-form"
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-ink-600 text-sm">Nombre y apellidos</span>
        <input
          type="text"
          name="name"
          required
          autoComplete="name"
          className={fieldClass}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-ink-600 text-sm">Teléfono</span>
          <input
            type="tel"
            name="phone"
            required
            autoComplete="tel"
            className={fieldClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-ink-600 text-sm">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className={fieldClass}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-ink-600 text-sm">Motivo de consulta</span>
          <input type="text" name="reason" className={fieldClass} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-ink-600 text-sm">Edad del paciente</span>
          <input type="text" name="patientAge" className={fieldClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-ink-600 text-sm">Mensaje</span>
        <textarea
          name="message"
          rows={5}
          className={`${fieldClass} resize-none`}
        />
      </label>

      <label className="flex items-start gap-3 text-ink-500 text-sm">
        <input
          type="checkbox"
          name="privacy"
          required
          className="mt-1 size-4 accent-sage-600"
        />
        <span>
          He leído y acepto la{" "}
          <Link href="/privacidad" className="underline underline-offset-2">
            política de privacidad
          </Link>
          . Los datos se utilizarán únicamente para responder a tu solicitud.
        </span>
      </label>

      {state && "error" in state && (
        <p
          role="alert"
          data-testid="contact-error"
          className="text-red-700 text-sm"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        data-testid="contact-submit"
        className="mt-2 cursor-pointer self-start rounded-full bg-sage-600 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Enviar solicitud"}
      </button>
    </form>
  );
}
