"use client";

import { useActionState } from "react";
import { type AccountFormState, rescheduleAppointment } from "../../actions";

const initialState: AccountFormState = undefined;

export function RescheduleForm({
  appointmentId,
  startsAt,
  from,
}: {
  appointmentId: string;
  startsAt: string;
  from: string;
}) {
  const [state, formAction, pending] = useActionState(
    rescheduleAppointment,
    initialState,
  );

  return (
    <form action={formAction} className="mt-8 flex flex-col gap-4">
      <input type="hidden" name="cita" value={appointmentId} />
      <input type="hidden" name="inicio" value={startsAt} />
      <input type="hidden" name="fecha" value={from} />
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
        data-testid="reschedule-confirm"
        className="cursor-pointer self-start rounded-full bg-sage-600 px-8 py-3 text-cream-50 transition-colors hover:bg-sage-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Cambiando…" : "Confirmar el cambio"}
      </button>
    </form>
  );
}
