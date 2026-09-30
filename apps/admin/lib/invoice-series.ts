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
  if (error.code === "P0001" && error.message === "number_invalid")
    return "El siguiente número debe ser 1 o mayor.";
  return "No se ha podido guardar la numeración.";
}
