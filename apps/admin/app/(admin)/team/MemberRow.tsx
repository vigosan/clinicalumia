"use client";

import { Badge } from "@clinicalumia/ui/badge";
import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
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
  const [error, setError] = useState<string | null>(null);

  const run = (
    action: () => Promise<{ ok: true } | { error: string }>,
    onOk?: () => void,
  ) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setError(null);
      onOk?.();
    });

  const specialtyName = specialties.find(
    (s) => s.id === member.specialty_id,
  )?.name;

  if (editing) {
    return (
      <li className="flex flex-wrap items-center gap-3 px-4 py-3 [&+&]:border-line [&+&]:border-t">
        <form
          action={(formData) =>
            run(
              () => updateMember(member.id, formData),
              () => setEditing(false),
            )
          }
          className="grid flex-1 gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <Field label="Nombre">
            <Input
              name="full_name"
              defaultValue={member.full_name}
              required
              autoFocus
            />
          </Field>
          <Field label="Especialidad">
            <Select
              name="specialty_id"
              defaultValue={member.specialty_id ?? ""}
            >
              <option value="">Sin asignar</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setEditing(false)}
            >
              Cancelar
            </Button>
          </div>
        </form>
        {error && (
          <p
            role="alert"
            data-testid="member-error"
            className="w-full text-[13px] text-danger-600"
          >
            {error}
          </p>
        )}
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 [&+&]:border-line [&+&]:border-t">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[15px] font-medium text-ink-900">
          {member.full_name}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-800">
          <span className="truncate">{member.email}</span>
          <Badge tone={specialtyName ? "success" : "neutral"}>
            {specialtyName ?? "Sin especialidad"}
          </Badge>
          {!member.is_active && (
            <Badge tone="warning" data-testid="member-status">
              Inactivo
            </Badge>
          )}
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setEditing(true)}
      >
        Editar
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={pending}
        onClick={() => run(() => resendInvite(member.email))}
      >
        Reenviar invitación
      </Button>
      <Button
        type="button"
        variant={member.is_active ? "danger" : "secondary"}
        size="sm"
        disabled={pending}
        onClick={() => run(() => setMemberActive(member.id, !member.is_active))}
      >
        {member.is_active ? "Desactivar" : "Activar"}
      </Button>
      {error && (
        <p
          role="alert"
          data-testid="member-error"
          className="w-full text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}
    </li>
  );
}
