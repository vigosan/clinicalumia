"use client";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { DatePicker } from "@clinicalumia/ui/date-picker";
import { Field } from "@clinicalumia/ui/field";
import { Select } from "@clinicalumia/ui/select";
import { Textarea } from "@clinicalumia/ui/textarea";
import { TimeSelect } from "@clinicalumia/ui/time-select";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { type Closure, closureOn } from "@/lib/closures";
import { noticeToast } from "@/lib/notice-toast";
import { createSubmitGate } from "@/lib/submit-gate";
import { toastOnRedirect } from "@/lib/toast-on-redirect";
import { canNotifyPatient, createAppointment } from "./actions";
import { DurationField } from "./DurationField";
import { type PatientOption, PatientPicker } from "./PatientPicker";

export type Professional = {
  id: string;
  fullName: string;
  specialtyId: string | null;
};

export type ServiceOption = {
  id: string;
  name: string;
  durationMinutes: number;
  specialtyId: string;
};

const createAppointmentWithToast = toastOnRedirect(
  createAppointment,
  noticeToast("Cita creada"),
);

export function AppointmentForm({
  professionals,
  fixedProfessionalId,
  services,
  initialDate,
  initialTime,
  initialProfessionalId,
  initialPatient,
  initialCanNotify,
  closures,
  cancelHref,
}: {
  professionals: Professional[];
  fixedProfessionalId: string | null;
  services: ServiceOption[];
  initialDate: string;
  initialTime: string;
  initialProfessionalId: string | null;
  initialPatient?: PatientOption | null;
  initialCanNotify: boolean;
  closures: Closure[];
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(
    createAppointmentWithToast,
    undefined,
  );
  const [professionalId, setProfessionalId] = useState(
    fixedProfessionalId ?? initialProfessionalId ?? professionals[0]?.id ?? "",
  );
  const [serviceId, setServiceId] = useState("");
  const [duration, setDuration] = useState("");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [patient, setPatient] = useState<PatientOption | null>(
    initialPatient ?? null,
  );
  const [canNotify, setCanNotify] = useState(initialCanNotify);
  const notifyCheckRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const submitGateRef = useRef(createSubmitGate());
  const dismissedStateRef = useRef(state);

  useEffect(() => {
    if (!pending) submitGateRef.current.finish();
  }, [pending]);

  const fixedProfessional = fixedProfessionalId
    ? professionals.find(
        (professional) => professional.id === fixedProfessionalId,
      )
    : undefined;
  const currentSpecialtyId =
    (fixedProfessional ?? professionals.find((p) => p.id === professionalId))
      ?.specialtyId ?? null;
  const filteredServices = services.filter(
    (service) => service.specialtyId === currentSpecialtyId,
  );

  const returnTo = (() => {
    const search = new URLSearchParams();
    if (date) search.set("date", date);
    if (time) search.set("time", time);
    if (professionalId) search.set("professional", professionalId);
    const query = search.toString();
    return query ? `/appointments/new?${query}` : "/appointments/new";
  })();

  const warnings =
    state && "warnings" in state && dismissedStateRef.current !== state
      ? state.warnings
      : [];
  const error = state && "error" in state ? state.error : null;
  const closure = closureOn(date, closures);

  function selectPatient(next: PatientOption) {
    setPatient(next);
    setCanNotify(false);
    notifyCheckRef.current = next.id;
    canNotifyPatient(next.id)
      .then((allowed) => {
        if (notifyCheckRef.current === next.id) setCanNotify(allowed);
      })
      .catch(() => {});
  }

  function resetConfirmation() {
    dismissedStateRef.current = state;
  }

  function submit(formData: FormData) {
    if (!submitGateRef.current.tryStart()) return;
    startTransition(() => formAction(formData));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(new FormData(event.currentTarget));
  }

  function handleConfirm() {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    formData.set("confirm", "1");
    submit(formData);
  }

  return (
    <form
      ref={formRef}
      data-testid="appointment-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
    >
      <input type="hidden" name="patient_id" value={patient?.id ?? ""} />
      <PatientPicker
        selected={patient}
        onSelect={selectPatient}
        onClear={() => {
          notifyCheckRef.current = null;
          setPatient(null);
          setCanNotify(false);
        }}
        returnTo={returnTo}
      />

      {fixedProfessional ? (
        <>
          <input
            type="hidden"
            name="professional_id"
            value={fixedProfessional.id}
          />
          <p className="text-[13px] text-ink-800">
            Profesional: {fixedProfessional.fullName}
          </p>
        </>
      ) : (
        <Field label="Profesional">
          <Select
            name="professional_id"
            data-testid="appointment-professional"
            value={professionalId}
            onValueChange={(next) => {
              setProfessionalId(next);
              setServiceId("");
              setDuration("");
              resetConfirmation();
            }}
            options={professionals.map((professional) => ({
              value: professional.id,
              label: professional.fullName,
            }))}
          />
        </Field>
      )}

      <Field label="Servicio">
        <Select
          name="service_id"
          data-testid="appointment-service"
          placeholder="Elige un servicio"
          value={serviceId}
          onValueChange={(next) => {
            setServiceId(next);
            const service = filteredServices.find((s) => s.id === next);
            if (service) setDuration(String(service.durationMinutes));
            resetConfirmation();
          }}
          options={filteredServices.map((service) => ({
            value: service.id,
            label: service.name,
          }))}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fecha">
          <DatePicker
            name="date"
            data-testid="appointment-date"
            today={todayInMadrid()}
            value={date}
            onValueChange={(next) => {
              setDate(next);
              resetConfirmation();
            }}
          />
        </Field>
        <Field label="Hora">
          <TimeSelect
            name="time"
            data-testid="appointment-time"
            value={time}
            onValueChange={(next) => {
              setTime(next);
              resetConfirmation();
            }}
          />
        </Field>
        <DurationField
          key={serviceId || professionalId}
          testId="appointment-duration"
          value={duration}
          onValueChange={(next) => {
            setDuration(next);
            resetConfirmation();
          }}
        />
      </div>

      {closure && (
        <Alert tone="warning" data-testid="appointment-closure-warning">
          La clínica está cerrada ese día ({closure.reason}). Puedes dar la cita
          igualmente.
        </Alert>
      )}

      <Field label="Notas">
        <Textarea name="notes" data-testid="appointment-notes" />
      </Field>

      {patient && canNotify && (
        <CheckboxField
          key={patient.id}
          name="notify"
          label="Avisar al paciente por email"
          data-testid="notify-patient"
          defaultChecked
        />
      )}

      {warnings.length > 0 && (
        <div
          role="alert"
          data-testid="appointment-warnings"
          className="flex flex-col gap-2 rounded-field border border-line bg-cream-200 p-3 text-[13px] text-ink-900"
        >
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            data-testid="appointment-confirm"
            onClick={handleConfirm}
          >
            Dar la cita igualmente
          </Button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          data-testid="appointment-error"
          className="text-[13px] text-danger-600"
        >
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <Button
          type="submit"
          disabled={pending}
          data-testid="appointment-submit"
        >
          {pending ? "Guardando…" : "Dar cita"}
        </Button>
        <Button asChild variant="secondary">
          <Link href={cancelHref}>Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
