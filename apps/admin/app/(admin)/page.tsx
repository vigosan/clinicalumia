import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Alert } from "@clinicalumia/ui/alert";
import { Button } from "@clinicalumia/ui/button";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { closureDays, longDay } from "@/lib/closures";
import { pendingSetup } from "@/lib/pending-setup";
import { nextFiling } from "@/lib/quarter";

const shortcuts = [
  { href: "/team", label: "Equipo", testId: "home-link-team" },
  { href: "/services", label: "Servicios", testId: "home-link-services" },
  { href: "/schedules", label: "Horarios", testId: "home-link-schedules" },
];

function StatusRow({
  label,
  testId,
  action,
  children,
}: {
  label: string;
  testId: string;
  action?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <li
      data-testid={testId}
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-4 [&+&]:border-separator [&+&]:border-t"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-[13px] text-text-tertiary">{label}</p>
        <p className="text-[15px] text-ink-900">{children}</p>
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full font-medium text-[15px] text-sage-900 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-sage-800 focus-visible:outline-offset-2"
        >
          {action.label}
          <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      )}
    </li>
  );
}

export default async function AdminHome() {
  const supabase = await createClient();
  const today = todayInMadrid();
  const year = Number(today.slice(0, 4));
  const filing = nextFiling(new Date());
  const results = await Promise.all([
    supabase
      .from("clinic_settings")
      .select("legal_name, tax_id, address_line, postal_code, city")
      .single(),
    supabase
      .from("invoice_series")
      .select("code, year, configured")
      .lte("year", year),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .not("specialty_id", "is", null)
      .order("full_name"),
    supabase.from("employee_schedules").select("profile_id"),
    supabase
      .from("clinic_closures")
      .select("starts_on, ends_on, reason")
      .gte("ends_on", today)
      .order("starts_on")
      .limit(1)
      .maybeSingle(),
  ]);
  const [
    { data: settings },
    { data: series },
    { count: activeServiceCount },
    { data: professionals },
    { data: schedules },
    { data: closure },
  ] = results;
  const loaded = results.every((result) => !result.error) && settings;
  const scheduled = new Set((schedules ?? []).map((row) => row.profile_id));
  const pending = loaded
    ? pendingSetup({
        settings,
        series: series ?? [],
        year,
        activeServiceCount: activeServiceCount ?? 0,
        professionalsWithoutSchedule: (professionals ?? []).filter(
          (professional) => !scheduled.has(professional.id),
        ),
      })
    : [];

  return (
    <>
      <PageHeader
        title="Estado de la clínica"
        description="Lo que falta por configurar y lo que viene."
      />
      {!loaded ? (
        <Alert data-testid="pending-error">
          No se ha podido comprobar qué falta por configurar. Recarga la página.
        </Alert>
      ) : (
        pending.length > 0 && (
          <Alert
            tone="warning"
            title="Pendiente de configurar"
            data-testid="pending-setup"
          >
            <ul className="mt-1 flex flex-col gap-1.5">
              {pending.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    data-testid={`pending-${item.id}`}
                    className="underline underline-offset-2"
                  >
                    {item.text}
                  </Link>
                </li>
              ))}
            </ul>
          </Alert>
        )
      )}
      <ul className="rounded-card bg-surface">
        {loaded && pending.length === 0 && (
          <StatusRow label="Configuración" testId="home-status-setup">
            <span data-testid="pending-none">
              Todo listo: la clínica puede dar citas, cobrar y facturar.
            </span>
          </StatusRow>
        )}
        <StatusRow
          label="Siguiente trimestre a presentar"
          testId="home-status-quarter"
          action={{
            href: `/facturacion?year=${filing.year}&q=${filing.q}`,
            label: "Ver facturación",
          }}
        >
          <span className="font-bold">
            T{filing.q} de {filing.year}
          </span>{" "}
          · hasta el {longDay(filing.deadline)}
        </StatusRow>
        {closure ? (
          <StatusRow
            label="Próximo cierre"
            testId="home-status-closure"
            action={{
              href: `/closures?month=${closure.starts_on.slice(0, 7)}`,
              label: "Ver cierres",
            }}
          >
            <span className="font-bold">{closureDays(closure)}</span> ·{" "}
            {closure.reason}
          </StatusRow>
        ) : (
          <StatusRow
            label="Próximo cierre"
            testId="home-status-closure"
            action={{ href: "/closures", label: "Añadir un cierre" }}
          >
            No hay cierres previstos.
          </StatusRow>
        )}
      </ul>
      <nav aria-label="Accesos" className="flex flex-wrap gap-2">
        {shortcuts.map((shortcut) => (
          <Button key={shortcut.href} asChild variant="secondary" size="sm">
            <Link href={shortcut.href} data-testid={shortcut.testId}>
              {shortcut.label}
            </Link>
          </Button>
        ))}
      </nav>
    </>
  );
}
