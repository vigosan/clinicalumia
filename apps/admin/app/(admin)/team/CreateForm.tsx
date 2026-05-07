"use client";

import { useActionState, useEffect, useRef } from "react";
import { createMember, type CreateMemberState } from "./actions";

type SpecialtyOption = { id: string; name: string };

const initialState: CreateMemberState = undefined;

export function CreateForm({ specialties }: { specialties: SpecialtyOption[] }) {
  const [state, formAction, pending] = useActionState(createMember, initialState);
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
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
    >
      <p className="text-sm font-medium text-slate-700">Nuevo miembro</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            name="email"
            required
            placeholder="medico@clinicalumia.es"
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Nombre completo</span>
          <input
            type="text"
            name="full_name"
            required
            placeholder="Dra. Patricia García"
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-slate-700">Especialidad</span>
          <select
            name="specialty_id"
            defaultValue=""
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none focus:border-slate-500"
          >
            <option value="">— Sin asignar —</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Invitando…" : "Invitar"}
        </button>
        {state && "error" in state && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        {state && "ok" in state && state.ok && (
          <p className="text-sm text-emerald-700">
            Invitación enviada por email.
          </p>
        )}
      </div>
    </form>
  );
}
