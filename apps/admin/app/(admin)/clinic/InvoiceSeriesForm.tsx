"use client";

import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { startTransition, useActionState, useState } from "react";
import {
  formatInvoiceCode,
  type InvoiceSeriesCode,
} from "@/lib/invoice-series";
import { type SaveInvoiceSeriesState, saveInvoiceSeries } from "./actions";

export function InvoiceSeriesForm({
  code,
  title,
  format: initialFormat,
  year: initialYear,
  nextNumber: initialNextNumber,
  locked,
}: {
  code: InvoiceSeriesCode;
  title: string;
  format: string;
  year: number;
  nextNumber: number;
  locked: boolean;
}) {
  const [format, setFormat] = useState(initialFormat);
  const [year, setYear] = useState(initialYear);
  const [nextNumber, setNextNumber] = useState(initialNextNumber);
  const isLockedYear = locked && year === initialYear;
  const [state, formAction, pending] = useActionState<
    SaveInvoiceSeriesState,
    FormData
  >(saveInvoiceSeries, undefined);

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-ink-900">{title}</h3>
      {isLockedYear && (
        <p
          data-testid={`invoice-series-${code}-locked`}
          className="text-[13px] text-ink-800"
        >
          {`La numeración de ${year} ya está en uso y no se puede cambiar.`}
        </p>
      )}
      <form
        data-testid={`invoice-series-${code}-form`}
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="code" value={code} />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={`Formato de ${title.toLowerCase()}`}>
            <Input
              name="format"
              data-testid={`invoice-series-${code}-format`}
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              disabled={isLockedYear}
              required
            />
          </Field>
          <Field label={`Año de ${title.toLowerCase()}`}>
            <Input
              name="year"
              type="number"
              data-testid={`invoice-series-${code}-year`}
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              required
            />
          </Field>
          <Field label={`Siguiente número de ${title.toLowerCase()}`}>
            <Input
              name="next_number"
              type="number"
              min={1}
              data-testid={`invoice-series-${code}-next-number`}
              value={nextNumber}
              onChange={(event) => setNextNumber(Number(event.target.value))}
              disabled={isLockedYear}
              required
            />
          </Field>
        </div>
        <p
          data-testid={`invoice-series-${code}-preview`}
          className="text-[13px] text-ink-800"
        >
          {`La próxima factura será ${formatInvoiceCode(format, year, nextNumber)}.`}
        </p>

        {state && "error" in state && (
          <p
            role="alert"
            data-testid={`invoice-series-${code}-error`}
            className="text-[13px] text-danger-600"
          >
            {state.error}
          </p>
        )}
        {state && "ok" in state && state.ok && (
          <p
            role="status"
            data-testid={`invoice-series-${code}-saved`}
            className="text-[13px] text-sage-900"
          >
            Numeración guardada.
          </p>
        )}

        <div>
          <Button
            type="submit"
            disabled={pending || isLockedYear}
            data-testid={`invoice-series-${code}-submit`}
          >
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
