import { madridDateParts } from "./format";

export const AEAT_QR_URL =
  "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu";

export const AEAT_QR_LABEL = "QR tributario:";

export function invoiceQrUrl({
  nif,
  code,
  issuedAt,
  totalCents,
}: {
  nif: string;
  code: string;
  issuedAt: string;
  totalCents: number;
}): string {
  const { day, month, year } = madridDateParts(issuedAt);
  const params: [string, string][] = [
    ["nif", nif],
    ["numserie", code],
    ["fecha", `${day}-${month}-${year}`],
    ["importe", (totalCents / 100).toFixed(2)],
  ];
  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
  return `${AEAT_QR_URL}?${query}`;
}
