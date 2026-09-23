"use client";

import { startTransition, useActionState } from "react";
import { consentSources } from "@/lib/consent";
import {
  consentClauses,
  marketingLabel,
  mediaForTrainingLabel,
  privacyLabel,
} from "@/lib/consent-legal";
import { type ConsentFormState, sendConsent } from "../actions";
import { SignaturePad } from "./SignaturePad";

const initialState: ConsentFormState = undefined;

const fieldClass =
  "rounded-2xl border border-sage-400/60 bg-cream-50 px-4 py-3 text-base text-ink-700 outline-none focus:border-sage-600";

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-ink-600 text-sm">{label}</span>
      <input {...props} className={fieldClass} />
    </label>
  );
}

export function ConsentForm() {
  const [state, formAction, pending] = useActionState(
    sendConsent,
    initialState,
  );

  if (state && "ok" in state) {
    return (
      <p
        data-testid="consent-success"
        className="rounded-panel bg-sage-500 px-8 py-12 text-center text-cream-50 text-lg"
      >
        ¡Gracias! Hemos recibido tu consentimiento firmado.
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      data-testid="consent-form"
      className="flex flex-col gap-6"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Nombre"
          name="firstName"
          required
          autoComplete="given-name"
        />
        <Field
          label="Apellidos"
          name="lastName"
          required
          autoComplete="family-name"
        />
        <Field
          label="Si es menor: nombre del padre, madre o tutor"
          name="guardian"
        />
        <Field
          label="Fecha de nacimiento"
          name="birthDate"
          type="date"
          required
        />
        <Field label="DNI / NIE" name="dni" required />
        <Field label="Email" name="email" type="email" autoComplete="email" />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-ink-600">
          ¿Cómo te has enterado de nuestros servicios?
        </legend>
        {consentSources.map((source) => (
          <label key={source} className="flex items-center gap-3 text-ink-500">
            <input
              type="checkbox"
              name="source"
              value={source}
              className="size-4 accent-sage-600"
            />
            {source}
          </label>
        ))}
      </fieldset>

      <div
        data-testid="consent-legal"
        className="flex flex-col gap-3 rounded-2xl bg-white/60 p-5 text-ink-500 text-sm leading-relaxed"
      >
        {consentClauses.map((clause) => (
          <p key={clause}>{clause}</p>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3 text-ink-500 text-sm">
          <input
            type="checkbox"
            name="privacy"
            required
            className="mt-1 size-4 accent-sage-600"
          />
          <span>{privacyLabel}</span>
        </label>
        <label className="flex items-start gap-3 text-ink-500 text-sm">
          <input
            type="checkbox"
            name="marketing"
            className="mt-1 size-4 accent-sage-600"
          />
          <span>{marketingLabel}</span>
        </label>
        <label className="flex items-start gap-3 text-ink-500 text-sm">
          <input
            type="checkbox"
            name="mediaForTraining"
            className="mt-1 size-4 accent-sage-600"
          />
          <span>{mediaForTrainingLabel}</span>
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-ink-600 text-sm">Firma</span>
        <SignaturePad name="signature" />
      </div>

      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden
        className="hidden"
      />

      {state && "error" in state && (
        <p
          role="alert"
          data-testid="consent-error"
          className="text-red-700 text-sm"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        data-testid="consent-submit"
        className="mt-2 cursor-pointer self-start rounded-full bg-sage-600 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Enviando…" : "Firmar y enviar"}
      </button>
    </form>
  );
}
