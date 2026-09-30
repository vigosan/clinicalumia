import { describe, expect, it } from "vitest";
import { AEAT_QR_URL, invoiceQrUrl } from "./qr";

describe("invoiceQrUrl", () => {
  it("points to the AEAT cotejo service for systems that do not submit to VERI*FACTU", () => {
    expect(AEAT_QR_URL).toBe(
      "https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu",
    );
  });

  it("URL-encodes the slash of the invoice code so the AEAT reads the whole number as one parameter", () => {
    const url = invoiceQrUrl({
      nif: "12345678Z",
      code: "34/26",
      issuedAt: "2026-09-30T10:15:00+02:00",
      totalCents: 4500,
    });

    expect(url).toBe(
      `${AEAT_QR_URL}?nif=12345678Z&numserie=34%2F26&fecha=30-09-2026&importe=45.00`,
    );
  });

  it("encodes characters that would otherwise split the query, as the AEAT example with & shows", () => {
    const url = invoiceQrUrl({
      nif: "12345678Z",
      code: "A&B 1/26",
      issuedAt: "2026-09-30T10:15:00+02:00",
      totalCents: 100,
    });

    expect(url).toContain("numserie=A%26B%201%2F26&");
  });

  it("uses the issue date in Madrid, so a late 31 December invoice keeps that year", () => {
    const lastNight = invoiceQrUrl({
      nif: "12345678Z",
      code: "90/26",
      issuedAt: "2026-12-31T22:30:00Z",
      totalCents: 4500,
    });
    const newYear = invoiceQrUrl({
      nif: "12345678Z",
      code: "1/27",
      issuedAt: "2026-12-31T23:30:00Z",
      totalCents: 4500,
    });

    expect(lastNight).toContain("fecha=31-12-2026");
    expect(newYear).toContain("fecha=01-01-2027");
  });

  it("writes the amount with a dot and two decimals, signed for rectifying invoices", () => {
    const rectifying = invoiceQrUrl({
      nif: "12345678Z",
      code: "R1/26",
      issuedAt: "2026-09-30T10:15:00+02:00",
      totalCents: -6050,
    });
    const large = invoiceQrUrl({
      nif: "12345678Z",
      code: "2/26",
      issuedAt: "2026-09-30T10:15:00+02:00",
      totalCents: 123456,
    });

    expect(rectifying).toMatch(/&importe=-60\.50$/);
    expect(large).toMatch(/&importe=1234\.56$/);
  });
});
