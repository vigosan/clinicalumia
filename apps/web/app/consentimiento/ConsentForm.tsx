"use client";

import { startTransition, useActionState, useReducer, useRef } from "react";
import { consentSources, type SignatureMethod } from "@/lib/consent";
import {
  consentClauses,
  marketingLabel,
  mediaForTrainingLabel,
  privacyLabel,
} from "@/lib/consent-legal";
import { initialSignatureChoice, signatureChoice } from "@/lib/typed-signature";
import { type ConsentFormState, sendConsent } from "../actions";
import { SignaturePad } from "./SignaturePad";
import { TypedSignature, typedSignaturePng } from "./TypedSignature";

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

const signatureModes: {
  method: SignatureMethod;
  label: string;
  testId: string;
}[] = [
  { method: "drawn", label: "Dibujar", testId: "signature-mode-draw" },
  { method: "typed", label: "Escribir", testId: "signature-mode-type" },
];

function SignatureModeSwitch({
  value,
  onChange,
}: {
  value: SignatureMethod;
  onChange: (method: SignatureMethod) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Forma de firmar"
      className="inline-flex rounded-full border border-sage-400/60 bg-cream-50 p-1"
    >
      {signatureModes.map((mode) => (
        <label
          key={mode.method}
          className="relative rounded-full px-4 py-1.5 text-ink-600 text-sm transition-colors has-checked:bg-sage-600 has-checked:text-cream-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-sage-700"
        >
          <input
            type="radio"
            name="signature_method"
            value={mode.method}
            checked={value === mode.method}
            onChange={() => onChange(mode.method)}
            data-testid={mode.testId}
            className="absolute inset-0 cursor-pointer appearance-none rounded-full outline-none"
          />
          {mode.label}
        </label>
      ))}
    </div>
  );
}

export function ConsentForm() {
  const [state, formAction, pending] = useActionState(
    sendConsent,
    initialState,
  );
  const [signature, dispatch] = useReducer(
    signatureChoice,
    initialSignatureChoice,
  );
  const typedPreview = useRef<HTMLDivElement>(null);

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
      onChange={(event) => {
        const data = new FormData(event.currentTarget);
        dispatch({
          type: "signer",
          firstName: String(data.get("firstName") ?? ""),
          lastName: String(data.get("lastName") ?? ""),
          guardian: String(data.get("guardian") ?? ""),
        });
      }}
      onSubmit={async (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        if (signature.method === "typed" && typedPreview.current) {
          formData.set(
            "signature",
            await typedSignaturePng(signature.typedName, typedPreview.current),
          );
        }
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

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-ink-600 text-sm">Firma</span>
          <SignatureModeSwitch
            value={signature.method}
            onChange={(method) => dispatch({ type: "method", method })}
          />
        </div>
        <div hidden={signature.method === "typed"}>
          <SignaturePad name="signature" />
        </div>
        {signature.method === "typed" && (
          <TypedSignature
            name={signature.typedName}
            onNameChange={(value) => dispatch({ type: "typedName", value })}
            previewRef={typedPreview}
          />
        )}
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
