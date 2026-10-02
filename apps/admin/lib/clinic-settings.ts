import { isValidSpanishTaxId, normalizeTaxId } from "@clinicalumia/api/tax-id";

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
  cancellation_hours: number;
  booking_min_notice_hours: number;
  booking_horizon_days: number;
};

export type ClinicSettingsFieldErrors = Partial<
  Record<keyof ClinicSettingsInput, string>
>;

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function parseClinicSettings(
  formData: FormData,
):
  | { ok: true; settings: ClinicSettingsInput }
  | { fieldErrors: ClinicSettingsFieldErrors } {
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
  const cancellationHoursText = text(formData, "cancellation_hours");
  const cancellationHours = Number(cancellationHoursText);
  const bookingMinNoticeHoursText = text(formData, "booking_min_notice_hours");
  const bookingMinNoticeHours = Number(bookingMinNoticeHoursText);
  const bookingHorizonDaysText = text(formData, "booking_horizon_days");
  const bookingHorizonDays = Number(bookingHorizonDaysText);

  const fieldErrors: ClinicSettingsFieldErrors = {};
  if (!legalName)
    fieldErrors.legal_name =
      "La razón social o nombre del titular es obligatorio.";
  if (!isValidSpanishTaxId(taxId))
    fieldErrors.tax_id =
      "El NIF/CIF no es válido. Revisa la letra o el dígito de control.";
  if (!POSTAL_CODE_REGEX.test(postalCode))
    fieldErrors.postal_code = "El código postal debe tener 5 cifras.";
  if (!EMAIL_REGEX.test(email)) fieldErrors.email = "El email no es válido.";
  if (!cancellationHoursText)
    fieldErrors.cancellation_hours = "Indica el plazo de cancelación gratuita.";
  else if (
    !Number.isInteger(cancellationHours) ||
    cancellationHours < 0 ||
    cancellationHours > 720
  )
    fieldErrors.cancellation_hours =
      "El plazo de cancelación debe estar entre 0 y 720 horas.";
  if (!bookingMinNoticeHoursText)
    fieldErrors.booking_min_notice_hours = "Indica la antelación mínima.";
  else if (
    !Number.isInteger(bookingMinNoticeHours) ||
    bookingMinNoticeHours < 0 ||
    bookingMinNoticeHours > 168
  )
    fieldErrors.booking_min_notice_hours =
      "La antelación mínima debe estar entre 0 y 168 horas.";
  if (!bookingHorizonDaysText)
    fieldErrors.booking_horizon_days = "Indica el horizonte de reserva.";
  else if (
    !Number.isInteger(bookingHorizonDays) ||
    bookingHorizonDays < 1 ||
    bookingHorizonDays > 365
  )
    fieldErrors.booking_horizon_days =
      "El horizonte de reserva debe estar entre 1 y 365 días.";
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

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
        website && !/^https?:\/\//i.test(website)
          ? `https://${website}`
          : website,
      vat_exemption_text: vatExemptionText,
      invoice_footer: invoiceFooter,
      cancellation_hours: cancellationHours,
      booking_min_notice_hours: bookingMinNoticeHours,
      booking_horizon_days: bookingHorizonDays,
    },
  };
}
