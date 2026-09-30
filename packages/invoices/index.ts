import QRCode from "qrcode";
import {
  DEFAULT_LOGO_PATH,
  QR_COLOR,
  renderInvoiceDocument,
} from "./InvoiceDocument";
import { invoiceQrUrl } from "./qr";
import type { InvoiceDetail } from "./types";

export { invoiceFileName } from "./format";
export { AEAT_QR_URL, invoiceQrUrl } from "./qr";
export type { InvoiceDetail, InvoiceSnapshot } from "./types";

function logoSource(logo: Uint8Array | undefined) {
  if (!logo) return DEFAULT_LOGO_PATH;
  const isJpeg = logo[0] === 0xff && logo[1] === 0xd8;
  return { data: Buffer.from(logo), format: isJpeg ? "jpg" : "png" } as const;
}

export async function renderInvoicePdf(
  detail: InvoiceDetail,
  { logo }: { logo?: Uint8Array } = {},
): Promise<Uint8Array> {
  const url = invoiceQrUrl({
    nif: (detail.qr as { nif: string }).nif,
    code: detail.code,
    issuedAt: detail.issued_at,
    totalCents: detail.total_cents,
  });
  const qr = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "M",
    margin: 0,
    width: 600,
    color: { dark: QR_COLOR, light: "#ffffff" },
  });
  const buffer = await renderInvoiceDocument({
    detail,
    logo: logoSource(logo),
    qr,
  });
  return new Uint8Array(buffer);
}
