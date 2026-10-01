"use client";

import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { DateRangePicker } from "@clinicalumia/ui/date-range-picker";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { madridRangePresets } from "@/lib/date-presets";
import {
  INVOICE_KIND_OPTIONS,
  type InvoiceKindFilter,
  type InvoicesParams,
  invoicesListHref,
} from "@/lib/invoices-load";
import type { StaffOption } from "@/lib/payments-load";

export function InvoicesFilters({
  params,
  staffOptions,
  isOwner,
}: {
  params: InvoicesParams;
  staffOptions: StaffOption[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState(params.q);
  const lastHref = useRef(invoicesListHref({ ...params, page: 1 }));

  useEffect(() => {
    const incoming = invoicesListHref({ ...params, page: 1 });
    if (incoming === lastHref.current) return;
    lastHref.current = incoming;
    setQuery(params.q);
  }, [params]);

  useEffect(() => {
    const href = invoicesListHref({ ...params, q: query, page: 1 });
    if (href === lastHref.current) return;
    const timeout = setTimeout(() => {
      lastHref.current = href;
      router.replace(href);
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, params, router]);

  function go(next: Partial<InvoicesParams>) {
    const href = invoicesListHref({ ...params, q: query, ...next, page: 1 });
    lastHref.current = href;
    router.push(href);
  }

  return (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Fechas">
        <DateRangePicker
          data-testid="invoices-range"
          from={params.desde}
          to={params.hasta}
          today={todayInMadrid()}
          presets={madridRangePresets()}
          onChange={({ from, to }) => go({ desde: from, hasta: to })}
        />
      </Field>
      <Field label="Tipo">
        <Select
          data-testid="invoices-kind"
          value={params.kind}
          onValueChange={(value) => go({ kind: value as InvoiceKindFilter })}
          options={INVOICE_KIND_OPTIONS}
        />
      </Field>
      <div className="min-w-0 flex-1">
        <Field label="Buscar por código o nombre">
          <Input
            data-testid="invoices-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </Field>
      </div>
      {isOwner && (
        <Field label="Profesional">
          <Select
            data-testid="invoices-professional"
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
