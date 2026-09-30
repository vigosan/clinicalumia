import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { effectiveSeries, invoiceSetupWarnings } from "@/lib/invoice-series";
import { ClinicSettingsForm } from "./ClinicSettingsForm";
import { InvoiceHeaderPreview } from "./InvoiceHeaderPreview";
import { InvoiceSeriesForm } from "./InvoiceSeriesForm";
import { LogoUploader } from "./LogoUploader";

const DEFAULT_FORMAT = { main: "{n}/{aa}", rectifying: "R{n}/{aa}" } as const;

export default async function ClinicPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("clinic_settings")
    .select("*")
    .single();
  const currentYear = Number(todayInMadrid().slice(0, 4));
  const years = [currentYear, currentYear + 1];
  const { data: series } = await supabase
    .from("invoice_series")
    .select("*")
    .lte("year", currentYear + 1);
  const rowsOf = (code: "main" | "rectifying") =>
    (series ?? []).filter((row) => row.code === code);
  const mainSeries = effectiveSeries(rowsOf("main"), currentYear);
  const rectifyingSeries = effectiveSeries(rowsOf("rectifying"), currentYear);
  const nextNumberOf = (row: typeof mainSeries) =>
    row?.year === currentYear ? row.next_number : 1;
  const warnings = invoiceSetupWarnings({
    settings: settings!,
    series: series ?? [],
    year: currentYear,
  });

  return (
    <>
      <PageHeader
        title="Datos de la clínica"
        description="Aparecen en las facturas y definen las condiciones de reserva."
      />
      {warnings.map((warning) => (
        <p
          key={warning.id}
          role="alert"
          data-testid={warning.id}
          className="rounded-card border border-warning-800 bg-warning-100 p-4 text-[15px] font-medium text-ink-900"
        >
          {warning.text}
        </p>
      ))}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <ClinicSettingsForm settings={settings!} />
        <div className="flex flex-col gap-6">
          <LogoUploader />
          <InvoiceHeaderPreview settings={settings!} />
        </div>
      </div>
      <h2 className="text-lg font-bold text-ink-900">Facturación</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <InvoiceSeriesForm
          code="main"
          title="Facturas"
          format={mainSeries?.format ?? DEFAULT_FORMAT.main}
          year={currentYear}
          nextNumber={nextNumberOf(mainSeries)}
          years={years}
          rows={rowsOf("main")}
          otherRows={rowsOf("rectifying")}
        />
        <InvoiceSeriesForm
          code="rectifying"
          title="Rectificativas"
          format={rectifyingSeries?.format ?? DEFAULT_FORMAT.rectifying}
          year={currentYear}
          nextNumber={nextNumberOf(rectifyingSeries)}
          years={years}
          rows={rowsOf("rectifying")}
          otherRows={rowsOf("main")}
        />
      </div>
    </>
  );
}
