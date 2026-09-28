"use client";

import { Button } from "@clinicalumia/ui/button";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import { Textarea } from "@clinicalumia/ui/textarea";
import Link from "next/link";
import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { createSubmitGate } from "@/lib/submit-gate";
import { createAppointment } from "./actions";
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

export function AppointmentForm({
  professionals,
  fixedProfessionalId,
  services,
  initialDate,
  initialTime,
  initialProfessionalId,
  initialPatient,
}: {
  professionals: Professional[];
  fixedProfessionalId: string | null;
  services: ServiceOption[];
  initialDate: string;
  initialTime: string;
  initialProfessionalId: string | null;
  initialPatient?: PatientOption | null;
}) {
  const [state, formAction, pending] = useActionState(
    createAppointment,
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
        onSelect={setPatient}
        onClear={() => setPatient(null)}
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
            onChange={(event) => {
              setProfessionalId(event.target.value);
              setServiceId("");
              setDuration("");
              resetConfirmation();
            }}
          >
            {professionals.map((professional) => (
              <option key={professional.id} value={professional.id}>
                {professional.fullName}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Servicio">
        <Select
          name="service_id"
          data-testid="appointment-service"
          value={serviceId}
          onChange={(event) => {
            const next = event.target.value;
            setServiceId(next);
            const service = filteredServices.find((s) => s.id === next);
            if (service) setDuration(String(service.durationMinutes));
            resetConfirmation();
          }}
        >
          <option value="">Selecciona un servicio</option>
          {filteredServices.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Fecha">
          <Input
            name="date"
            type="date"
            data-testid="appointment-date"
            defaultValue={initialDate}
            onChange={(event) => {
              setDate(event.target.value);
              resetConfirmation();
            }}
          />
        </Field>
        <Field label="Hora">
          <Input
            name="time"
            type="time"
            data-testid="appointment-time"
            defaultValue={initialTime}
            onChange={(event) => {
              setTime(event.target.value);
              resetConfirmation();
            }}
          />
        </Field>
        <Field label="Duración (minutos)">
          <Input
            name="duration_minutes"
            type="number"
            step={5}
            min={5}
            max={480}
            data-testid="appointment-duration"
            value={duration}
            onChange={(event) => {
              setDuration(event.target.value);
              resetConfirmation();
            }}
          />
        </Field>
      </div>

      <Field label="Notas">
        <Textarea name="notes" data-testid="appointment-notes" />
      </Field>

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
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
