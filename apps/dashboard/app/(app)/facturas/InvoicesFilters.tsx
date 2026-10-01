"use client";

import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
      <Field label="Desde">
        <Input
          type="date"
          data-testid="invoices-from"
          value={params.desde}
          onChange={(event) => go({ desde: event.target.value })}
        />
      </Field>
      <Field label="Hasta">
        <Input
          type="date"
          data-testid="invoices-to"
          value={params.hasta}
          onChange={(event) => go({ hasta: event.target.value })}
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
