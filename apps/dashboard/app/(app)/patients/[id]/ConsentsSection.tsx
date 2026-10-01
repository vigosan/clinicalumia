import { Card } from "@clinicalumia/ui/card";
import { formatSignedAt } from "@/lib/consents";

export type PatientConsent = {
  id: string;
  signedAt: string;
  marketing: boolean;
  mediaForTraining: boolean;
  pdfUrl: string | null;
};

function yesNo(value: boolean): string {
  return value ? "Sí" : "No";
}

export function ConsentsSection({
  consents,
  error,
}: {
  consents: PatientConsent[];
  error: boolean;
}) {
  return (
    <Card className="flex flex-col gap-2" data-testid="patient-consents">
      <h2 className="text-lg font-bold text-ink-900">Consentimientos</h2>
      {error ? (
        <p role="alert" className="text-sm text-danger-600">
          No se han podido cargar los consentimientos. Recarga la página.
        </p>
      ) : consents.length === 0 ? (
        <p className="text-sm text-ink-800">Sin consentimientos firmados</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {consents.map((consent) => (
            <li
              key={consent.id}
              data-testid="patient-consent"
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-md border border-line px-3 py-2 text-[15px] text-ink-900"
            >
              <span>
                {formatSignedAt(consent.signedAt).slice(0, 10)} · Publicidad:{" "}
                {yesNo(consent.marketing)} · Imágenes para formación:{" "}
                {yesNo(consent.mediaForTraining)}
              </span>
              {consent.pdfUrl ? (
                <a
                  href={consent.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="patient-consent-pdf"
                  className="font-medium underline"
                >
                  Ver PDF
                </a>
              ) : (
                <span role="alert" className="text-sm text-danger-600">
                  No se ha podido cargar el PDF.
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
