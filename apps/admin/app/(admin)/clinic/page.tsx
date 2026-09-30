import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { PageHeader } from "@clinicalumia/ui/page-header";
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
  const { data: series } = await supabase
    .from("invoice_series")
    .select("*")
    .eq("year", currentYear);
  const mainSeries = series?.find((row) => row.code === "main");
  const rectifyingSeries = series?.find((row) => row.code === "rectifying");
  const missingFiscalData =
    !settings!.legal_name.trim() || !settings!.tax_id.trim();

  return (
    <>
      <PageHeader
        title="Datos de la clínica"
        description="Aparecen en las facturas y definen las condiciones de reserva."
      />
      {missingFiscalData && (
        <p
          role="alert"
          data-testid="clinic-fiscal-warning"
          className="rounded-card border border-warning-800 bg-warning-100 p-4 text-[15px] font-medium text-ink-900"
        >
          Faltan la razón social o el NIF: sin estos datos no se pueden emitir
          facturas ni registrar cobros.
        </p>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <ClinicSettingsForm settings={settings!} />
        <div className="flex flex-col gap-6">
          <LogoUploader />
          <InvoiceHeaderPreview settings={settings!} />
        </div>
      </div>
      <div className="grid gap-6 sm:grid-cols-2">
        <InvoiceSeriesForm
          code="main"
          title="Facturas"
          format={mainSeries?.format ?? DEFAULT_FORMAT.main}
          year={mainSeries?.year ?? currentYear}
          nextNumber={mainSeries?.next_number ?? 1}
          locked={mainSeries?.locked ?? false}
        />
        <InvoiceSeriesForm
          code="rectifying"
          title="Rectificativas"
          format={rectifyingSeries?.format ?? DEFAULT_FORMAT.rectifying}
          year={rectifyingSeries?.year ?? currentYear}
          nextNumber={rectifyingSeries?.next_number ?? 1}
          locked={rectifyingSeries?.locked ?? false}
        />
      </div>
    </>
  );
}
