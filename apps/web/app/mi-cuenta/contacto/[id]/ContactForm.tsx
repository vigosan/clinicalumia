"use client";

import { startTransition, useActionState } from "react";
import type { AccountFormState } from "../../citas/actions";
import { updateContact } from "../../personas/actions";

const fieldClass =
  "rounded-2xl border border-sage-400/60 bg-cream-50 px-4 py-3 text-base text-ink-700 outline-none focus:border-sage-600";

const initialState: AccountFormState = undefined;

export function ContactForm({
  personId,
  phone,
  address,
  phoneRequired,
}: {
  personId: string;
  phone: string;
  address: string;
  phoneRequired: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateContact,
    initialState,
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="mt-8 flex flex-col gap-4"
    >
      <input type="hidden" name="persona" value={personId} />
      <label className="flex flex-col gap-1.5">
        <span className="text-ink-600 text-sm">
          {phoneRequired ? "Teléfono" : "Teléfono (opcional)"}
        </span>
        <input
          type="tel"
          name="phone"
          defaultValue={phone}
          required={phoneRequired}
          autoComplete="tel"
          data-testid="contact-phone"
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-ink-600 text-sm">Dirección</span>
        <input
          type="text"
          name="address"
          defaultValue={address}
          maxLength={300}
          autoComplete="street-address"
          data-testid="contact-address"
          className={fieldClass}
        />
      </label>
      {state?.error && (
        <p
          role="alert"
          data-testid="account-error"
          className="text-red-700 text-sm"
        >
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        data-testid="contact-submit"
        className="cursor-pointer self-start rounded-full bg-sage-600 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
