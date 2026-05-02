"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createSpecialty,
  type SpecialtyFormState,
} from "./actions";

const initialState: SpecialtyFormState = undefined;

export function CreateForm() {
  const [state, formAction, pending] = useActionState(
    createSpecialty,
    initialState,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state && "ok" in state && state.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"
    >
      <label className="flex-1 space-y-1 text-sm">
        <span className="text-slate-700">Nueva especialidad</span>
        <input
          type="text"
          name="name"
          required
          placeholder="Logopedia, Psicología…"
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
      >
        {pending ? "Añadiendo…" : "Añadir"}
      </button>

      {state && "error" in state && (
        <p className="text-sm text-red-600 sm:order-last sm:w-full" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
