"use client";

import { useState, useTransition } from "react";
import { deleteSpecialty, renameSpecialty } from "./actions";

type Specialty = {
  id: string;
  name: string;
  slug: string;
};

export function SpecialtyRow({ specialty }: { specialty: Specialty }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
        <form
          action={(formData) =>
            startTransition(async () => {
              await renameSpecialty(specialty.id, formData);
              setEditing(false);
            })
          }
          className="flex flex-1 items-center gap-3"
        >
          <input
            type="text"
            name="name"
            defaultValue={specialty.name}
            required
            autoFocus
            className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-slate-500"
          />
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
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex-1">
        <p className="text-slate-900">{specialty.name}</p>
        <p className="text-xs text-slate-500">{specialty.slug}</p>
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
        onClick={() => {
          if (!confirm(`¿Eliminar "${specialty.name}"?`)) return;
          startTransition(() => deleteSpecialty(specialty.id));
        }}
        disabled={pending}
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 transition hover:border-red-400 disabled:opacity-60"
      >
        {pending ? "…" : "Eliminar"}
      </button>
    </li>
  );
}
