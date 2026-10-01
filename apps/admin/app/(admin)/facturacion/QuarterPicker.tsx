"use client";

import { Field } from "@clinicalumia/ui/field";
import { Select } from "@clinicalumia/ui/select";
import { useRouter } from "next/navigation";

const QUARTER_OPTIONS = [
  { value: "1", label: "T1 · enero–marzo" },
  { value: "2", label: "T2 · abril–junio" },
  { value: "3", label: "T3 · julio–septiembre" },
  { value: "4", label: "T4 · octubre–diciembre" },
];

export function QuarterPicker({
  year,
  q,
  years,
}: {
  year: number;
  q: number;
  years: number[];
}) {
  const router = useRouter();

  function go(nextYear: string, nextQ: string) {
    router.push(`/facturacion?year=${nextYear}&q=${nextQ}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Año">
        <Select
          data-testid="quarter-year"
          value={String(year)}
          onValueChange={(value) => go(value, String(q))}
          options={years.map((option) => ({
            value: String(option),
            label: String(option),
          }))}
        />
      </Field>
      <Field label="Trimestre">
        <Select
          data-testid="quarter-q"
          value={String(q)}
          onValueChange={(value) => go(String(year), value)}
          options={QUARTER_OPTIONS}
        />
      </Field>
    </div>
  );
}
