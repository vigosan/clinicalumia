"use client";

import { useActionState } from "react";
import { type AccountFormState, cancelAppointment } from "../../actions";

const initialState: AccountFormState = undefined;

export function CancelForm({ appointmentId }: { appointmentId: string }) {
  const [state, formAction, pending] = useActionState(
    cancelAppointment,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="cita" value={appointmentId} />
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
        data-testid="cancel-confirm"
        className="cursor-pointer self-start rounded-full bg-sage-600 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Cancelando…" : "Cancelar cita"}
      </button>
    </form>
  );
}
