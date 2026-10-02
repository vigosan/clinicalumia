"use client";

import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import { startTransition, useActionState, useState } from "react";
import {
  formatInvoiceCode,
  type InvoiceSeriesCode,
  type InvoiceSeriesRow,
  invoiceFormatPresets,
  invoiceFormatProblem,
  seriesYearSummary,
} from "@/lib/invoice-series";
import { type SaveInvoiceSeriesState, saveInvoiceSeries } from "./actions";

const OTHER_FORMAT = "other";

export function InvoiceSeriesForm({
  code,
  title,
  format: initialFormat,
  year: initialYear,
  nextNumber: initialNextNumber,
  years,
  rows,
  otherRows,
}: {
  code: InvoiceSeriesCode;
  title: string;
  format: string;
  year: number;
  nextNumber: number;
  years: number[];
  rows: (InvoiceSeriesRow & { year: number })[];
  otherRows: { year: number; format: string }[];
}) {
  const [format, setFormat] = useState(initialFormat);
  const [year, setYear] = useState(initialYear);
  const [nextNumber, setNextNumber] = useState(initialNextNumber);
  const presets = invoiceFormatPresets(code, year);
  const isPreset = (candidate: string) =>
    presets.some((preset) => preset.format === candidate);
  const [customFormat, setCustomFormat] = useState(!isPreset(initialFormat));
  const selectedRow = rows.find((row) => row.year === year);
  const isLockedYear = selectedRow?.locked ?? false;
  const otherFormat =
    otherRows
      .filter((row) => row.year <= year)
      .sort((a, b) => b.year - a.year)[0]?.format ?? null;
  const problem = isLockedYear
    ? null
    : invoiceFormatProblem(format, otherFormat, year);
  const [state, formAction, pending] = useActionState<
    SaveInvoiceSeriesState,
    FormData
  >(saveInvoiceSeries, undefined);

  return (
    <Card className="flex flex-col gap-4">
      <h3 className="text-base font-bold text-ink-900">{title}</h3>
      <ul className="flex flex-col gap-1 text-[13px] text-ink-800">
        {years.map((listedYear) => (
          <li
            key={listedYear}
            data-testid={`invoice-series-${code}-summary-${listedYear}`}
          >
            {seriesYearSummary(
              listedYear,
              rows.find((row) => row.year === listedYear),
            )}
          </li>
        ))}
      </ul>
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
          <Field label="Formato" hint="Así sería la primera factura del año.">
            <Select
              data-testid={`invoice-series-${code}-format-choice`}
              value={customFormat ? OTHER_FORMAT : format}
              onValueChange={(choice) => {
                if (choice === OTHER_FORMAT) {
                  setCustomFormat(true);
                  return;
                }
                setCustomFormat(false);
                setFormat(choice);
              }}
              options={[
                ...presets.map((preset) => ({
                  value: preset.format,
                  label: preset.example,
                })),
                { value: OTHER_FORMAT, label: "Otro formato" },
              ]}
              disabled={isLockedYear}
            />
          </Field>
          <Field label="Año">
            <Input
              name="year"
              type="number"
              data-testid={`invoice-series-${code}-year`}
              value={year}
              onChange={(event) => {
                const nextYear = Number(event.target.value);
                const row = rows.find(
                  (candidate) => candidate.year === nextYear,
                );
                setYear(nextYear);
                if (row) {
                  setFormat(row.format);
                  if (!isPreset(row.format)) setCustomFormat(true);
                  setNextNumber(row.next_number);
                }
              }}
              required
            />
          </Field>
          <Field label="Siguiente número">
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
        {customFormat ? (
          <Field
            label="Tu formato"
            hint="{n} es el número, {n:4} el número con ceros (0001), {aa} el año con dos cifras y {año} con cuatro."
          >
            <Input
              name="format"
              data-testid={`invoice-series-${code}-format`}
              value={format}
              onChange={(event) => setFormat(event.target.value)}
              disabled={isLockedYear}
              required
            />
          </Field>
        ) : (
          <input type="hidden" name="format" value={format} />
        )}
        <p
          data-testid={`invoice-series-${code}-preview`}
          className={`text-[13px] ${problem ? "text-danger-600" : "text-ink-800"}`}
        >
          {problem ??
            `La próxima factura será ${formatInvoiceCode(format, year, nextNumber)}.`}
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
            disabled={pending || isLockedYear || problem !== null}
            data-testid={`invoice-series-${code}-submit`}
          >
            {pending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
