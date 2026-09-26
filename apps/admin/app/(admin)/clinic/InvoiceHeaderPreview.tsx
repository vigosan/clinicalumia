import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import Image from "next/image";

type ClinicSettings = {
  legal_name: string;
  tax_id: string;
  address_line: string;
  postal_code: string;
  city: string;
  province: string;
  phone: string;
  email: string;
  logo_path: string | null;
};

export async function InvoiceHeaderPreview({
  settings,
}: {
  settings: ClinicSettings;
}) {
  const supabase = await createClient();
  const publicUrl = settings.logo_path
    ? supabase.storage.from("branding").getPublicUrl(settings.logo_path).data
        .publicUrl
    : null;

  return (
    <Card data-testid="logo-preview" className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink-900">
        Vista previa de la cabecera de factura
      </h2>
      {publicUrl ? (
        <Image
          src={publicUrl}
          alt="Logo de la clínica"
          width={192}
          height={48}
          unoptimized
          style={{ height: "48px", width: "auto" }}
        />
      ) : (
        <p className="text-sm text-ink-800">Aún no hay logo</p>
      )}
      <div className="flex flex-col gap-1 text-[15px] text-ink-900">
        <p className="font-bold">{settings.legal_name}</p>
        <p>NIF {settings.tax_id}</p>
        <p>
          {settings.address_line}, {settings.postal_code} {settings.city} (
          {settings.province})
        </p>
        <p>
          {settings.phone} · {settings.email}
        </p>
      </div>
    </Card>
  );
}
