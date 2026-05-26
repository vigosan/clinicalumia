"use client";

import { useState, useTransition } from "react";
import { resendInvite, setMemberActive, updateMember } from "./actions";

type Specialty = { id: string; name: string };

type Member = {
  id: string;
  email: string;
  full_name: string;
  specialty_id: string | null;
  is_active: boolean;
};

export function MemberRow({
  member,
  specialties,
}: {
  member: Member;
  specialties: Specialty[];
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const specialtyName = specialties.find(
    (s) => s.id === member.specialty_id,
  )?.name;

  if (editing) {
    return (
      <li className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <form
          action={(formData) =>
            startTransition(async () => {
              await updateMember(member.id, formData);
              setEditing(false);
            })
          }
          className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Nombre</span>
            <input
              type="text"
              name="full_name"
              defaultValue={member.full_name}
              required
              autoFocus
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 outline-none focus:border-slate-500"
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-slate-700">Especialidad</span>
            <select
              name="specialty_id"
              defaultValue={member.specialty_id ?? ""}
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 outline-none focus:border-slate-500"
            >
              <option value="">— Sin asignar —</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:border-slate-500"
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="truncate text-slate-900">{member.full_name}</p>
        <p className="truncate text-xs text-slate-500">
          {member.email}
          {specialtyName ? ` · ${specialtyName}` : " · sin especialidad"}
          {!member.is_active && " · inactivo"}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:border-slate-500"
      >
        Editar
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(() => resendInvite(member.email))}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:border-slate-500 disabled:opacity-60"
      >
        Reenviar invitación
      </button>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => setMemberActive(member.id, !member.is_active))
        }
        className={`rounded-md border px-3 py-1.5 text-sm transition disabled:opacity-60 ${
          member.is_active
            ? "border-red-200 text-red-600 hover:border-red-400"
            : "border-emerald-300 text-emerald-700 hover:border-emerald-500"
        }`}
      >
        {member.is_active ? "Desactivar" : "Activar"}
      </button>
    </li>
  );
}
