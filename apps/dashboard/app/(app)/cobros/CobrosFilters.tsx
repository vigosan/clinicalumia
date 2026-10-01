"use client";

import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { DateRangePicker } from "@clinicalumia/ui/date-range-picker";
import { Field } from "@clinicalumia/ui/field";
import { Select } from "@clinicalumia/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { madridRangePresets } from "@/lib/date-presets";
import {
  type CobrosParams,
  cobrosListHref,
  MAX_RANGE_DAYS,
  type StaffOption,
} from "@/lib/payments-load";

export function CobrosFilters({
  params,
  staffOptions,
  isOwner,
}: {
  params: CobrosParams;
  staffOptions: StaffOption[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const isSingleDay = params.desde === params.hasta;

  function go(next: Partial<CobrosParams>) {
    router.push(cobrosListHref({ ...params, ...next }));
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      {isSingleDay && (
        <div className="flex items-center gap-2">
          <Link
            href={cobrosListHref({
              ...params,
              desde: addDays(params.desde, -1),
              hasta: addDays(params.desde, -1),
            })}
            data-testid="payments-prev-day"
            aria-label="Día anterior"
            className="flex size-9 items-center justify-center rounded-full border border-line text-ink-900 hover:bg-cream-200"
          >
            ‹
          </Link>
          <Link
            href={cobrosListHref({
              ...params,
              desde: addDays(params.desde, 1),
              hasta: addDays(params.desde, 1),
            })}
            data-testid="payments-next-day"
            aria-label="Día siguiente"
            className="flex size-9 items-center justify-center rounded-full border border-line text-ink-900 hover:bg-cream-200"
          >
            ›
          </Link>
        </div>
      )}
      <Field label="Fechas">
        <DateRangePicker
          data-testid="payments-range"
          from={params.desde}
          to={params.hasta}
          today={todayInMadrid()}
          presets={madridRangePresets()}
          maxDays={MAX_RANGE_DAYS}
          onChange={({ from, to }) => go({ desde: from, hasta: to })}
        />
      </Field>
      {isOwner && (
        <Field label="Profesional">
          <Select
            data-testid="payments-professional"
            value={params.profesionalId ?? ""}
            onValueChange={(value) => go({ profesionalId: value || null })}
            options={[
              { value: "", label: "Todo el equipo" },
              ...staffOptions.map((staff) => ({
                value: staff.id,
                label: `${staff.fullName} · ${staff.specialtyName ?? "Sin especialidad"}`,
              })),
            ]}
          />
        </Field>
      )}
    </div>
  );
}
