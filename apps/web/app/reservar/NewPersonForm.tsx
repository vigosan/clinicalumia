"use client";

import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { type BookingFormState, savePerson } from "./actions";

type PersonAction = (
  prev: BookingFormState,
  formData: FormData,
) => Promise<BookingFormState>;

const fieldClass =
  "rounded-2xl border border-sage-400/60 bg-cream-50 px-4 py-3 text-base text-ink-700 outline-none focus:border-sage-600";

const RELATIONSHIP_OPTIONS = [
  { value: "madre", label: "Madre" },
  { value: "padre", label: "Padre" },
  { value: "tutor_legal", label: "Tutor legal" },
  { value: "otro", label: "Otro" },
];

const initialState: BookingFormState = undefined;

type Guardian = { id: string; name: string };

function Field({
  label,
  name,
  type = "text",
  required = true,
  autoComplete,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  max?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-ink-600 text-sm">{label}</span>
      <input
        type={type}
        name={name}
        required={required}
        autoComplete={autoComplete}
        max={max}
        data-testid={`new-person-${name}`}
        className={fieldClass}
      />
    </label>
  );
}

function PersonFields({
  legend,
  hideLegend = false,
  prefix,
  today,
  adult,
}: {
  legend: string;
  hideLegend?: boolean;
  prefix: string;
  today: string;
  adult: boolean;
}) {
  const own = adult ? "" : "off";
  return (
    <fieldset className="flex flex-col gap-4">
      <legend
        className={hideLegend ? "sr-only" : "mb-2 font-bold text-ink-600"}
      >
        {legend}
      </legend>
      <Field
        label="Nombre"
        name={`${prefix}first_name`}
        autoComplete={own || "given-name"}
      />
      <Field
        label="Apellidos"
        name={`${prefix}last_name`}
        autoComplete={own || "family-name"}
      />
      <Field
        label="Fecha de nacimiento"
        name={`${prefix}birth_date`}
        type="date"
        max={today}
        autoComplete={own || "bday"}
      />
      <Field
        label={adult ? "Teléfono" : "Teléfono (opcional)"}
        name={`${prefix}phone`}
        type="tel"
        required={adult}
        autoComplete={own || "tel"}
      />
    </fieldset>
  );
}

export function NewPersonForm({
  estado,
  needsPrivacy,
  guardians,
  today,
  warning,
  action = savePerson,
  minorOnly = false,
  errorTestId = "booking-error",
}: {
  estado: string;
  needsPrivacy: boolean;
  guardians: Guardian[];
  today: string;
  warning: string | null;
  action?: PersonAction;
  minorOnly?: boolean;
  errorTestId?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const error = state?.error ?? warning;
  const [forMinor, setForMinor] = useState(minorOnly || guardians.length > 0);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      data-testid="new-person-form"
      className="flex flex-col gap-8"
    >
      <input type="hidden" name="estado" value={estado} />

      {!minorOnly && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 font-bold text-ink-600">
            ¿Para quién es?
          </legend>
          <label className="flex items-center gap-3 text-ink-600">
            <input
              type="radio"
              name="para"
              value="yo"
              checked={!forMinor}
              onChange={() => setForMinor(false)}
              data-testid="new-person-for-me"
              className="size-4 accent-sage-600"
            />
            Es para mí
          </label>
          <label className="flex items-center gap-3 text-ink-600">
            <input
              type="radio"
              name="para"
              value="menor"
              checked={forMinor}
              onChange={() => setForMinor(true)}
              data-testid="new-person-for-minor"
              className="size-4 accent-sage-600"
            />
            Soy su madre/padre/tutor
          </label>
        </fieldset>
      )}

      {!forMinor && (
        <PersonFields
          legend="Para ti"
          hideLegend
          prefix=""
          today={today}
          adult
        />
      )}

      {forMinor &&
        (guardians.length > 0 ? (
          <label className="flex flex-col gap-1.5">
            <span className="text-ink-600 text-sm">
              ¿Quién es su madre, padre o tutor?
            </span>
            <select
              name="guardian_id"
              data-testid="new-person-guardian_id"
              className={fieldClass}
            >
              {guardians.map((guardian) => (
                <option key={guardian.id} value={guardian.id}>
                  {guardian.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <PersonFields
            legend="Tú, como madre, padre o tutor"
            prefix="guardian_"
            today={today}
            adult
          />
        ))}

      {forMinor && (
        <>
          <PersonFields
            legend="Datos del menor"
            prefix=""
            today={today}
            adult={false}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-ink-600 text-sm">Relación con el menor</span>
            <select
              name="relationship"
              required
              defaultValue=""
              data-testid="new-person-relationship"
              className={fieldClass}
            >
              <option value="" disabled>
                Elige una opción
              </option>
              {RELATIONSHIP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {needsPrivacy && (
        <label className="flex items-start gap-3 text-ink-500 text-sm">
          <input
            type="checkbox"
            name="privacy"
            required
            data-testid="privacy-accept"
            className="mt-1 size-4 accent-sage-600"
          />
          <span>
            He leído y acepto la{" "}
            <Link
              href="/privacidad"
              target="_blank"
              className="text-sage-600 underline underline-offset-2"
            >
              política de privacidad
            </Link>
          </span>
        </label>
      )}

      {error && (
        <p
          role="alert"
          data-testid={errorTestId}
          className="text-red-700 text-sm"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        data-testid="new-person-submit"
        className="cursor-pointer self-start rounded-full bg-sage-600 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Continuar"}
      </button>
    </form>
  );
}
