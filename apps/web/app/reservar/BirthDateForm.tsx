"use client";

import { useActionState } from "react";
import { type BookingFormState, completeBirthDate } from "./actions";

const initialState: BookingFormState = undefined;

export function BirthDateForm({
  estado,
  today,
}: {
  estado: string;
  today: string;
}) {
  const [state, formAction, pending] = useActionState(
    completeBirthDate,
    initialState,
  );

  return (
    <form
      action={formAction}
      data-testid="birth-date-form"
      className="flex flex-col gap-8"
    >
      <input type="hidden" name="estado" value={estado} />
      <label className="flex flex-col gap-1.5">
        <span className="text-ink-600 text-sm">Fecha de nacimiento</span>
        <input
          type="date"
          name="birth_date"
          required
          max={today}
          data-testid="birth-date-input"
          className="rounded-2xl border border-sage-400/60 bg-cream-50 px-4 py-3 text-base text-ink-700 outline-none focus:border-sage-600"
        />
      </label>
      {state?.error && (
        <p
          role="alert"
          data-testid="booking-error"
          className="text-red-700 text-sm"
        >
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        data-testid="birth-date-submit"
        className="cursor-pointer self-start rounded-full bg-sage-600 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Continuar"}
      </button>
    </form>
  );
}
