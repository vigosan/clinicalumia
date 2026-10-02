"use client";

import { Alert } from "@clinicalumia/ui/alert";
import { Badge } from "@clinicalumia/ui/badge";
import { Button } from "@clinicalumia/ui/button";
import { ConfirmDialog } from "@clinicalumia/ui/confirm-dialog";
import { useState, useTransition } from "react";
import type { AffectedAppointment } from "@/lib/affected-appointments";
import {
  resendInvite,
  resetTwoFactor,
  revokeCalendarLink,
  setMemberActive,
} from "./actions";
import { EditMember } from "./EditMember";

type Specialty = { id: string; name: string };

type Member = {
  id: string;
  email: string;
  full_name: string;
  specialty_id: string | null;
  is_active: boolean;
  role: "owner" | "employee";
  license_number: string | null;
};

export function MemberRow({
  member,
  pendingInvitation,
  specialties,
}: {
  member: Member;
  pendingInvitation: boolean;
  specialties: Specialty[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [upcoming, setUpcoming] = useState<AffectedAppointment[]>([]);

  const run = (
    action: () => Promise<
      { ok: true } | { error: string; appointments?: AffectedAppointment[] }
    >,
    onOk?: () => void,
  ) =>
    startTransition(async () => {
      setSuccess(null);
      const result = await action();
      if ("error" in result) {
        setError(result.error);
        setUpcoming(result.appointments ?? []);
        return;
      }
      setError(null);
      setUpcoming([]);
      onOk?.();
    });

  const specialtyName = specialties.find(
    (s) => s.id === member.specialty_id,
  )?.name;

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3 [&+&]:border-line [&+&]:border-t">
      <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-1">
        <p className="truncate text-[15px] font-medium text-ink-900">
          {member.full_name}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-800">
          <span className="truncate">{member.email}</span>
          {member.role === "owner" && <Badge tone="bark">Propietaria</Badge>}
          <Badge tone={specialtyName ? "success" : "neutral"}>
            {specialtyName ?? "Sin especialidad"}
          </Badge>
          {pendingInvitation && (
            <Badge tone="warning" data-testid="member-pending">
              Pendiente de aceptar
            </Badge>
          )}
          {!member.is_active && (
            <Badge tone="warning" data-testid="member-status">
              Inactivo
            </Badge>
          )}
          {member.license_number && (
            <span data-testid="member-license">
              Nº colegiado {member.license_number}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <EditMember member={member} specialties={specialties} />
        <ConfirmDialog
          tone="destructive"
          trigger={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              data-testid="member-revoke-calendar"
            >
              Cortar el acceso al calendario del móvil
            </Button>
          }
          title="¿Cortar el acceso al calendario del móvil?"
          description="Su enlace de calendario dejará de funcionar. Tendrá que generar uno nuevo desde el panel."
          confirmLabel="Cortar el acceso"
          onConfirm={() =>
            run(
              () => revokeCalendarLink(member.id),
              () => setSuccess("Acceso al calendario del móvil cortado."),
            )
          }
        />
        {member.role !== "owner" && pendingInvitation && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            data-testid="member-resend-invite"
            onClick={() =>
              run(
                () => resendInvite(member.email),
                () => setSuccess("Invitación reenviada."),
              )
            }
          >
            Reenviar invitación
          </Button>
        )}
        {member.role !== "owner" && (
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                data-testid="member-reset-2fa"
              >
                Restablecer verificación
              </Button>
            }
            title="¿Restablecer la verificación en dos pasos?"
            description="La próxima vez que entre tendrá que activarla de nuevo."
            confirmLabel="Restablecer"
            onConfirm={() => run(() => resetTwoFactor(member.id))}
          />
        )}
        {member.role !== "owner" &&
          (member.is_active ? (
            <ConfirmDialog
              tone="destructive"
              trigger={
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={pending}
                >
                  Desactivar
                </Button>
              }
              title={`¿Desactivar a ${member.full_name}?`}
              description="Dejará de poder entrar en el dashboard. Si tiene citas pendientes, antes hay que moverlas a otra profesional o cancelarlas. Puedes volver a activarla cuando quieras."
              confirmLabel="Desactivar"
              onConfirm={() => run(() => setMemberActive(member.id, false))}
            />
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => setMemberActive(member.id, true))}
            >
              Activar
            </Button>
          ))}
      </div>
      {success && (
        <p
          role="status"
          data-testid="member-success"
          className="w-full text-[13px] text-sage-900"
        >
          {success}
        </p>
      )}
      {error && upcoming.length > 0 && (
        <Alert data-testid="member-upcoming" title={error} className="w-full">
          <ul className="mt-2 flex flex-col gap-1">
            {upcoming.map((appointment) => (
              <li key={appointment.id} data-testid="member-upcoming-item">
                {appointment.date} · {appointment.time} · {appointment.patient}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      {error && upcoming.length === 0 && (
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
