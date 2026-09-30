import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/agenda";
import { consentLinkErrorMessage } from "@/lib/consent-link-error";
import { formatSignedAt, linkedPersonLabel } from "@/lib/consents";
import { ConsentActions } from "./ConsentActions";

function yesNo(value: boolean): string {
  return value ? "sí" : "no";
}

export default async function ConsentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ linkError?: string }>;
}) {
  const { id } = await params;
  const { linkError } = await searchParams;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();

  const { data: consent, error } = await supabase
    .from("consents")
    .select(
      "id, signed_at, first_name, last_name, birth_date, tax_id, email, guardian_name, sources, marketing, media_for_training, pdf_path, person:people(id, first_name, last_name, archived_at)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    return (
      <Card role="alert" className="text-center text-sm text-danger-600">
        No se ha podido cargar el consentimiento. Recarga la página.
      </Card>
    );
  }
  if (!consent) notFound();

  const { data: signed } = await supabase.storage
    .from("consents")
    .createSignedUrl(consent.pdf_path, 300);

  return (
    <>
      <PageHeader
        title={`${consent.first_name} ${consent.last_name}`}
        description={`Firmado el ${formatSignedAt(consent.signed_at)}`}
      />
      <Card className="flex flex-col gap-2" data-testid="consent-details">
        <p>
          <strong>DNI/NIE:</strong> {consent.tax_id}
        </p>
        <p>
          <strong>Fecha de nacimiento:</strong>{" "}
          {`${consent.birth_date.slice(8, 10)}/${consent.birth_date.slice(5, 7)}/${consent.birth_date.slice(0, 4)}`}
        </p>
        <p>
          <strong>Email:</strong> {consent.email ?? "—"}
        </p>
        {consent.guardian_name && (
          <p>
            <strong>Padre, madre o tutor:</strong> {consent.guardian_name}
          </p>
        )}
        <p>
          <strong>Cómo nos ha conocido:</strong>{" "}
          {consent.sources.join(", ") || "—"}
        </p>
        <p>Publicidad: {yesNo(consent.marketing)}</p>
        <p>Imágenes para formación: {yesNo(consent.media_for_training)}</p>
        {signed ? (
          <a
            href={signed.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="consent-pdf"
            className="font-medium underline"
          >
            Ver PDF
          </a>
        ) : (
          <p role="alert" className="text-sm text-danger-600">
            No se ha podido cargar el PDF. Recarga la página.
          </p>
        )}
      </Card>
      <Card className="flex flex-col gap-3">
        <p data-testid="consent-status">
          {consent.person ? (
            <>
              Asociado a{" "}
              <Link href={`/patients/${consent.person.id}`}>
                {linkedPersonLabel(consent.person)}
              </Link>
            </>
          ) : (
            "Pendiente de asociar"
          )}
        </p>
        <ConsentActions
          consentId={consent.id}
          linked={Boolean(consent.person)}
          initialError={consentLinkErrorMessage(linkError)}
        />
      </Card>
    </>
  );
}
