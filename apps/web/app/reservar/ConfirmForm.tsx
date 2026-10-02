"use client";

import { useActionState } from "react";
import { type BookingFormState, confirmBooking } from "./actions";

const initialState: BookingFormState = undefined;

export function ConfirmForm({ estado }: { estado: string }) {
  const [state, formAction, pending] = useActionState(
    confirmBooking,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="estado" value={estado} />
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
        data-testid="booking-confirm"
        className="cursor-pointer self-start rounded-full bg-sage-800 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-900 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Confirmando…" : "Confirmar cita"}
      </button>
    </form>
  );
}
