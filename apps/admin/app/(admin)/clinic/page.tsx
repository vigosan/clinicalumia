import { createClient } from "@clinicalumia/api/server";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { ClinicSettingsForm } from "./ClinicSettingsForm";
import { InvoiceHeaderPreview } from "./InvoiceHeaderPreview";
import { LogoUploader } from "./LogoUploader";

export default async function ClinicPage() {
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("clinic_settings")
    .select("*")
    .single();

  return (
    <>
      <PageHeader
        title="Datos de la clínica"
        description="Aparecen en las facturas y definen las condiciones de reserva."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <ClinicSettingsForm settings={settings!} />
        <div className="flex flex-col gap-6">
          <LogoUploader />
          <InvoiceHeaderPreview settings={settings!} />
        </div>
      </div>
    </>
  );
}
