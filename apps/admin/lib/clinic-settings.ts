import { isValidSpanishTaxId, normalizeTaxId } from "./tax-id";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POSTAL_CODE_REGEX = /^\d{5}$/;

export type ClinicSettingsInput = {
  legal_name: string;
  tax_id: string;
  address_line: string;
  postal_code: string;
  city: string;
  province: string;
  phone: string;
  email: string;
  website: string;
  vat_exemption_text: string;
  invoice_footer: string;
  invoice_prefix: string;
  rectifying_prefix: string;
  cancellation_hours: number;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function parseClinicSettings(
  formData: FormData,
): { ok: true; settings: ClinicSettingsInput } | { error: string } {
  const legalName = text(formData, "legal_name");
  const taxId = normalizeTaxId(text(formData, "tax_id"));
  const addressLine = text(formData, "address_line");
  const postalCode = text(formData, "postal_code");
  const city = text(formData, "city");
  const province = text(formData, "province");
  const phone = text(formData, "phone");
  const email = text(formData, "email");
  const website = text(formData, "website");
  const vatExemptionText = text(formData, "vat_exemption_text");
  const invoiceFooter = text(formData, "invoice_footer");
  const invoicePrefix = text(formData, "invoice_prefix");
  const rectifyingPrefix = text(formData, "rectifying_prefix");
  const cancellationHours = Number(text(formData, "cancellation_hours"));

  if (!legalName)
    return { error: "La razón social o nombre del titular es obligatorio." };
  if (!isValidSpanishTaxId(taxId))
    return {
      error: "El NIF/CIF no es válido. Revisa la letra o el dígito de control.",
    };
  if (!POSTAL_CODE_REGEX.test(postalCode))
    return { error: "El código postal debe tener 5 cifras." };
  if (!EMAIL_REGEX.test(email)) return { error: "El email no es válido." };
  if (
    !Number.isInteger(cancellationHours) ||
    cancellationHours < 0 ||
    cancellationHours > 720
  )
    return {
      error: "El plazo de cancelación debe estar entre 0 y 720 horas.",
    };

  return {
    ok: true,
    settings: {
      legal_name: legalName,
      tax_id: taxId,
      address_line: addressLine,
      postal_code: postalCode,
      city,
      province,
      phone,
      email,
      website:
        website && !website.startsWith("https://")
          ? `https://${website}`
          : website,
      vat_exemption_text: vatExemptionText,
      invoice_footer: invoiceFooter,
      invoice_prefix: invoicePrefix,
      rectifying_prefix: rectifyingPrefix,
      cancellation_hours: cancellationHours,
    },
  };
}
