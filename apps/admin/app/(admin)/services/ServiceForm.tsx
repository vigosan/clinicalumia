"use client";

import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { type ServiceFormState, saveService } from "./actions";

type Specialty = { id: string; name: string };
type Service = {
  id: string;
  specialty_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  vat: "exempt" | "standard_21";
  bookable_online: boolean;
  booking_payment: "none" | "fixed" | "percent" | "full";
  booking_payment_value: number;
  cancellation_hours: number | null;
};

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ServiceForm({
  specialties,
  service,
}: {
  specialties: Specialty[];
  service?: Service;
}) {
  const [state, formAction, pending] = useActionState<
    ServiceFormState,
    FormData
  >(saveService, undefined);
  const [payment, setPayment] = useState(service?.booking_payment ?? "none");

  return (
    <form
      data-testid="service-form"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-5"
    >
      {service && <input type="hidden" name="id" value={service.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Especialidad">
          <Select
            name="specialty_id"
            defaultValue={service?.specialty_id ?? ""}
            required
          >
            <option value="" disabled>
              Elige una especialidad
            </option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nombre">
          <Input name="name" defaultValue={service?.name} required />
        </Field>
        <Field label="Duración (minutos)">
          <Input
            name="duration_minutes"
            type="number"
            min={5}
            max={480}
            step={5}
            defaultValue={service?.duration_minutes ?? 60}
            required
          />
        </Field>
        <Field label="Precio" hint="En euros, por ejemplo 45 o 45,50.">
          <Input
            name="price"
            inputMode="decimal"
            defaultValue={service ? centsToInput(service.price_cents) : ""}
            required
          />
        </Field>
        <Field label="IVA">
          <Select name="vat" defaultValue={service?.vat ?? "exempt"}>
            <option value="exempt">Exento · servicio sanitario</option>
            <option value="standard_21">21 %</option>
          </Select>
        </Field>
        <Field
          label="Plazo de cancelación propio (horas)"
          hint="Déjalo vacío para usar el de la clínica."
        >
          <Input
            name="cancellation_hours"
            type="number"
            min={0}
            max={720}
            defaultValue={service?.cancellation_hours ?? ""}
          />
        </Field>
      </div>

      <CheckboxField
        name="bookable_online"
        label="Se puede reservar desde la web"
        defaultChecked={service?.bookable_online ?? false}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Qué se paga al reservar">
          <Select
            name="booking_payment"
            value={payment}
            onChange={(event) =>
              setPayment(event.target.value as Service["booking_payment"])
            }
          >
            <option value="none">Nada, se paga en la clínica</option>
            <option value="fixed">Una señal fija</option>
            <option value="percent">Un porcentaje</option>
            <option value="full">El precio completo</option>
          </Select>
        </Field>
        {payment === "fixed" && (
          <Field label="Importe de la señal" hint="En euros.">
            <Input
              name="booking_payment_value"
              inputMode="decimal"
              defaultValue={
                service?.booking_payment === "fixed"
                  ? centsToInput(service.booking_payment_value)
                  : ""
              }
              required
            />
          </Field>
        )}
        {payment === "percent" && (
          <Field label="Porcentaje del precio">
            <Input
              name="booking_payment_value"
              type="number"
              min={1}
              max={100}
              defaultValue={
                service?.booking_payment === "percent"
                  ? service.booking_payment_value
                  : ""
              }
              required
            />
          </Field>
        )}
      </div>

      {state?.error && (
        <p
          role="alert"
          data-testid="service-error"
          className="text-[13px] text-danger-600"
        >
          {state.error}
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" disabled={pending} data-testid="service-submit">
          {pending ? "Guardando…" : "Guardar servicio"}
        </Button>
        <Button asChild variant="secondary">
          <Link href="/services">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
