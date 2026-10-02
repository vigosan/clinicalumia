"use client";

import {
  startTransition,
  useActionState,
  useReducer,
  useRef,
  useState,
} from "react";
import { Turnstile } from "@/components/Turnstile";
import {
  checkPersonalId,
  consentSources,
  type SignatureMethod,
} from "@/lib/consent";
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

const TYPED_SIGNATURE_FAILED =
  "No se ha podido generar la firma. Prueba a dibujarla.";

const personalIdHints = {
  passport:
    "Parece un pasaporte. Si tienes DNI o NIE, escríbelo; si no, puedes seguir.",
  invalid: "Revisa el DNI/NIE.",
} as const;

const fieldClass =
  "rounded-2xl border border-sage-400/60 bg-cream-50 px-4 py-3 text-base text-ink-800 outline-none focus:border-sage-600";

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-ink-800 text-sm">{label}</span>
      <input {...props} className={fieldClass} />
    </label>
  );
}

function PersonalIdField({ label, name }: { label: string; name: string }) {
  const [check, setCheck] =
    useState<ReturnType<typeof checkPersonalId>>("empty");
  const hint =
    check === "passport" || check === "invalid" ? personalIdHints[check] : null;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-ink-800 text-sm">{label}</span>
        <input
          name={name}
          autoComplete="off"
          onBlur={(event) => setCheck(checkPersonalId(event.target.value))}
          aria-describedby={hint ? `${name}-hint` : undefined}
          data-testid={`consent-${name}`}
          className={fieldClass}
        />
      </label>
      {hint && (
        <span
          id={`${name}-hint`}
          data-testid={`consent-${name}-hint`}
          className="text-ink-800 text-sm"
        >
          {hint}
        </span>
      )}
    </div>
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
          className="relative rounded-full px-4 py-1.5 text-ink-800 text-sm transition-colors has-checked:bg-sage-800 has-checked:text-cream-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-1 has-focus-visible:outline-sage-700"
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

export function ConsentForm({
  turnstileSiteKey,
}: {
  turnstileSiteKey?: string;
}) {
  const [state, formAction, pending] = useActionState(
    sendConsent,
    initialState,
  );
  const [submits, setSubmits] = useState(0);
  const [preparing, setPreparing] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [signature, dispatch] = useReducer(
    signatureChoice,
    initialSignatureChoice,
  );
  const typedPreview = useRef<HTMLDivElement>(null);
  const error =
    signatureError ?? (state && "error" in state ? state.error : null);

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
      action={formAction}
      method="POST"
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
        if (preparing || pending) return;
        const formData = new FormData(event.currentTarget);
        setSignatureError(null);
        setPreparing(true);
        if (signature.method === "typed" && typedPreview.current) {
          try {
            formData.set(
              "signature",
              await typedSignaturePng(
                signature.typedName,
                typedPreview.current,
              ),
            );
          } catch {
            setPreparing(false);
            setSignatureError(TYPED_SIGNATURE_FAILED);
            return;
          }
        }
        setSubmits((count) => count + 1);
        startTransition(() => {
          setPreparing(false);
          formAction(formData);
        });
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
        <PersonalIdField label="DNI/NIE del paciente" name="dni" />
        <PersonalIdField
          label="Si es menor: DNI/NIE del padre, madre o tutor"
          name="guardianDni"
        />
        <div className="flex flex-col gap-1.5">
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            aria-describedby="email-hint"
          />
          <span id="email-hint" className="text-ink-800 text-sm">
            Te enviaremos una copia del consentimiento firmado.
          </span>
        </div>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-ink-800">
          ¿Cómo te has enterado de nuestros servicios?
        </legend>
        {consentSources.map((source) => (
          <label key={source} className="flex items-center gap-3 text-ink-800">
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
        className="flex flex-col gap-3 rounded-2xl bg-white/60 p-5 text-ink-800 text-sm leading-relaxed"
      >
        {consentClauses.map((clause) => (
          <p key={clause}>{clause}</p>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3 text-ink-800 text-sm">
          <input
            type="checkbox"
            name="privacy"
            required
            className="mt-1 size-4 accent-sage-600"
          />
          <span>{privacyLabel}</span>
        </label>
        <label className="flex items-start gap-3 text-ink-800 text-sm">
          <input
            type="checkbox"
            name="marketing"
            className="mt-1 size-4 accent-sage-600"
          />
          <span>{marketingLabel}</span>
        </label>
        <label className="flex items-start gap-3 text-ink-800 text-sm">
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
          <span className="text-ink-800 text-sm">Firma</span>
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

      {turnstileSiteKey && (
        <Turnstile
          key={submits}
          siteKey={turnstileSiteKey}
          action="consentimiento"
        />
      )}

      {error && (
        <p
          role="alert"
          data-testid="consent-error"
          className="text-red-700 text-sm"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || preparing}
        data-testid="consent-submit"
        className="mt-2 cursor-pointer self-start rounded-full bg-sage-800 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending || preparing ? "Enviando…" : "Firmar y enviar"}
      </button>
    </form>
  );
}
