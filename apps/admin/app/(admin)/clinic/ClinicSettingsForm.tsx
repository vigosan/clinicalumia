"use client";

import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Textarea } from "@clinicalumia/ui/textarea";
import { startTransition, useActionState } from "react";
import { type SaveClinicSettingsState, saveClinicSettings } from "./actions";

type ClinicSettings = {
  legal_name: string;
  tax_id: string;
  address_line: string;
  postal_code: string;
  city: string;
  province: string;
  phone: string;
  email: string;
  website: string;
  vat_exemption_text: string;
  invoice_footer: string;
  cancellation_hours: number;
  booking_min_notice_hours: number;
  booking_horizon_days: number;
};

export function ClinicSettingsForm({ settings }: { settings: ClinicSettings }) {
  const [state, formAction, pending] = useActionState<
    SaveClinicSettingsState,
    FormData
  >(saveClinicSettings, undefined);

  return (
    <form
      data-testid="clinic-form"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-5"
    >
      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink-900">Datos fiscales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Razón social o nombre del titular">
            <Input
              name="legal_name"
              defaultValue={settings.legal_name}
              required
            />
          </Field>
          <Field label="NIF / CIF">
            <Input name="tax_id" defaultValue={settings.tax_id} required />
          </Field>
          <Field label="Dirección">
            <Input
              name="address_line"
              defaultValue={settings.address_line}
              required
            />
          </Field>
          <Field label="Código postal">
            <Input
              name="postal_code"
              defaultValue={settings.postal_code}
              required
            />
          </Field>
          <Field label="Localidad">
            <Input name="city" defaultValue={settings.city} required />
          </Field>
          <Field label="Provincia">
            <Input name="province" defaultValue={settings.province} required />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink-900">Contacto</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Teléfono">
            <Input name="phone" defaultValue={settings.phone} required />
          </Field>
          <Field label="Email">
            <Input
              name="email"
              type="email"
              defaultValue={settings.email}
              required
            />
          </Field>
          <Field label="Web">
            <Input name="website" defaultValue={settings.website} />
          </Field>
        </div>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink-900">Facturas y reservas</h2>
        <Field label="Texto de exención de IVA">
          <Textarea
            name="vat_exemption_text"
            defaultValue={settings.vat_exemption_text}
          />
        </Field>
        <Field
          label="Pie de factura"
          hint="Por ejemplo, la cuenta para transferencias."
        >
          <Textarea
            name="invoice_footer"
            defaultValue={settings.invoice_footer}
          />
        </Field>
        <Field
          label="Plazo de cancelación gratuita (horas)"
          hint="Se aplica a todos los servicios salvo que un servicio tenga el suyo."
        >
          <Input
            name="cancellation_hours"
            type="number"
            min={0}
            max={720}
            defaultValue={settings.cancellation_hours}
            required
          />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-ink-900">Reserva web</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Antelación mínima (horas)">
            <Input
              name="booking_min_notice_hours"
              type="number"
              min={0}
              max={168}
              defaultValue={settings.booking_min_notice_hours}
              required
            />
          </Field>
          <Field label="Hasta cuántos días se puede reservar">
            <Input
              name="booking_horizon_days"
              type="number"
              min={1}
              max={365}
              defaultValue={settings.booking_horizon_days}
              required
            />
          </Field>
        </div>
      </Card>

      {state && "error" in state && (
        <p
          role="alert"
          data-testid="clinic-error"
          className="text-[13px] text-danger-600"
        >
          {state.error}
        </p>
      )}
      {state && "ok" in state && state.ok && (
        <p
          role="status"
          data-testid="clinic-saved"
          className="text-[13px] text-sage-900"
        >
          Datos guardados.
        </p>
      )}

      <div>
        <Button type="submit" disabled={pending} data-testid="clinic-submit">
          {pending ? "Guardando…" : "Guardar datos"}
        </Button>
      </div>
    </form>
  );
}
