export type InvoiceSeriesCode = "main" | "rectifying";

export type InvoiceSeriesInput = {
  code: InvoiceSeriesCode;
  format: string;
  year: number;
  next_number: number;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function formatInvoiceCode(
  format: string,
  year: number,
  number: number,
): string {
  if (!Number.isInteger(year) || !Number.isInteger(number) || number < 1)
    return "";
  let result = format
    .replaceAll("{año}", String(year))
    .replaceAll("{aa}", String(year % 100).padStart(2, "0"))
    .replaceAll("{n}", String(number));
  result = result.replace(/\{n:([1-8])\}/g, (_match, width: string) =>
    String(number).padStart(
      Math.max(Number(width), String(number).length),
      "0",
    ),
  );
  return result;
}

const NUMBER_MARKER = /\{n(?::[1-8])?\}/g;
const KNOWN_MARKERS = /\{(?:año|aa|n|n:[1-8])\}/g;

function escapeRegExp(text: string): string {
  return text.replace(/[^A-Za-z0-9]/g, "\\$&");
}

function codeShape(format: string, year: number): RegExp {
  const withYear = format
    .replaceAll("{año}", String(year))
    .replaceAll("{aa}", String(year % 100).padStart(2, "0"));
  const [prefix = "", suffix = ""] = withYear.split(/\{n(?::[1-8])?\}/);
  return new RegExp(`^${escapeRegExp(prefix)}[0-9]+${escapeRegExp(suffix)}$`);
}

function formatsCollide(format: string, other: string, year: number) {
  const shape = codeShape(format, year);
  const otherShape = codeShape(other, year);
  for (let number = 1; number <= 1000; number++) {
    if (
      otherShape.test(formatInvoiceCode(format, year, number)) ||
      shape.test(formatInvoiceCode(other, year, number))
    )
      return true;
  }
  return false;
}

export function invoiceFormatProblem(
  format: string,
  otherFormat: string | null,
  year: number,
): string | null {
  const trimmed = format.trim();
  if (!trimmed) return "Escribe el formato.";
  if (trimmed.length > 30) return "El formato no puede pasar de 30 caracteres.";
  const rest = trimmed.replace(KNOWN_MARKERS, "");
  if (/[{}]/.test(rest))
    return "Solo se admiten {n}, {n:1} a {n:8}, {aa} y {año}.";
  if (!/^[A-Za-z0-9/_.-]*$/.test(rest))
    return "Usa solo letras, números y los signos / _ . -";
  const numbers = trimmed.match(NUMBER_MARKER)?.length ?? 0;
  if (numbers === 0) return "Falta el número ({n} o {n:4}).";
  if (numbers > 1) return "Solo puede haber un número ({n} o {n:4}).";
  if (!/\{(?:año|aa)\}/.test(trimmed)) return "Falta el año ({aa} o {año}).";
  if (otherFormat && formatsCollide(trimmed, otherFormat, year))
    return "Da los mismos códigos que la otra serie. Usa una letra que las distinga, como R{n}/{aa}.";
  return null;
}

export function parseInvoiceSeries(
  formData: FormData,
): { ok: true; series: InvoiceSeriesInput } | { error: string } {
  const code = text(formData, "code");
  if (code !== "main" && code !== "rectifying")
    return { error: "Serie no válida." };
  const format = text(formData, "format");
  const yearText = text(formData, "year");
  const year = Number(yearText);
  const nextNumberText = text(formData, "next_number");
  const nextNumber = Number(nextNumberText);
  if (!format) return { error: "Indica el formato de la numeración." };
  if (!yearText || !Number.isInteger(year) || year < 2000 || year > 2999)
    return { error: "Indica un año válido." };
  if (!nextNumberText || !Number.isInteger(nextNumber) || nextNumber < 1)
    return { error: "El siguiente número debe ser 1 o mayor." };
  return {
    ok: true,
    series: { code, format, year, next_number: nextNumber },
  };
}

export type DbError = { code?: string; message?: string };

export function invoiceSeriesError(error: DbError, year: number): string {
  if (error.code === "42501") return "No tienes permiso para hacer esto.";
  if (error.code === "P0001" && error.message === "series_locked")
    return `La numeración de ${year} ya está en uso y no se puede cambiar.`;
  if (error.code === "P0001" && error.message === "format_invalid")
    return "El formato de la numeración no es válido.";
  if (error.code === "P0001" && error.message === "format_conflict")
    return "Ese formato puede dar los mismos códigos que la otra serie. Usa una letra que las distinga, como R{n}/{aa}.";
  if (error.code === "P0001" && error.message === "number_invalid")
    return "El siguiente número debe ser 1 o mayor.";
  return "No se ha podido guardar la numeración.";
}

export type SetupWarning = { id: string; text: string };

export function effectiveSeries<Row extends { year: number }>(
  rows: Row[],
  year: number,
): Row | undefined {
  return rows
    .filter((row) => row.year <= year)
    .sort((a, b) => b.year - a.year)[0];
}

export function invoiceSetupWarnings({
  settings,
  series,
  year,
}: {
  settings: {
    legal_name: string;
    tax_id: string;
    address_line: string;
    postal_code: string;
    city: string;
  };
  series: { code: InvoiceSeriesCode; year: number; configured: boolean }[];
  year: number;
}): SetupWarning[] {
  const mainSeries = effectiveSeries(
    series.filter((row) => row.code === "main"),
    year,
  );
  const warnings: SetupWarning[] = [];
  if (!settings.legal_name.trim() || !settings.tax_id.trim())
    warnings.push({
      id: "clinic-fiscal-warning",
      text: "Faltan la razón social o el NIF: sin estos datos no se pueden emitir facturas ni registrar cobros.",
    });
  if (
    !settings.address_line.trim() ||
    !settings.postal_code.trim() ||
    !settings.city.trim()
  )
    warnings.push({
      id: "clinic-address-warning",
      text: "Falta la dirección completa (dirección, código postal y ciudad): sin ella no se pueden emitir facturas completas ni rectificativas, ni anular cobros facturados.",
    });
  if (!mainSeries?.configured)
    warnings.push({
      id: "invoice-series-warning",
      text: `Confirma la numeración de facturas de ${year} en Facturación: hasta que la guardes, no se pueden registrar cobros.`,
    });
  return warnings;
}

export type InvoiceSeriesRow = {
  format: string;
  next_number: number;
  locked: boolean;
  configured: boolean;
};

export function seriesYearSummary(
  year: number,
  row: InvoiceSeriesRow | undefined,
): string {
  if (!row) return `${year}: seguirá el formato de ${year - 1}, empezando en 1`;
  const state = row.locked
    ? "en uso"
    : row.configured
      ? "confirmada"
      : "sin confirmar";
  return `${year}: próxima ${formatInvoiceCode(row.format, year, row.next_number)} · ${state}`;
}
