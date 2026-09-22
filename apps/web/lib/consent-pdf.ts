import { PDFDocument, type PDFFont, rgb, StandardFonts } from "pdf-lib";
import type { Consent } from "./consent";
import {
  consentClauses,
  consentTitle,
  marketingLabel,
  privacyLabel,
} from "./consent-legal";
import { PENDING, site } from "./site";

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 56;
const INK = rgb(0.28, 0.28, 0.28);
const SAGE = rgb(0.63, 0.65, 0.57);
const PENDING_RED = rgb(0.75, 0.1, 0.1);

function encodable(font: PDFFont, text: string) {
  return Array.from(text)
    .map((char) => {
      try {
        font.encodeText(char);
        return char;
      } catch {
        const base = char.normalize("NFD").replace(/\p{M}/gu, "");
        try {
          font.encodeText(base);
          return base;
        } catch {
          return "?";
        }
      }
    })
    .join("");
}

function wrap(font: PDFFont, text: string, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Madrid",
  }).format(date);
}

export async function buildConsentPdf(
  consent: Consent,
  signedAt: Date,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const fullName = `${consent.firstName} ${consent.lastName}`;
  pdf.setTitle(`${consentTitle} · ${fullName}`);
  pdf.setAuthor(site.name);
  pdf.setCreationDate(signedAt);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const signature = await pdf.embedPng(consent.signature);

  let page = pdf.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - MARGIN;
  const width = PAGE.width - MARGIN * 2;

  const write = (
    text: string,
    { font = regular, size = 10, color = INK, gap = 4 } = {},
  ) => {
    for (const line of wrap(font, encodable(font, text), size, width)) {
      if (y < MARGIN + size) {
        page = pdf.addPage([PAGE.width, PAGE.height]);
        y = PAGE.height - MARGIN;
      }
      page.drawText(line, {
        x: MARGIN,
        y,
        size,
        font,
        color: line.includes(PENDING) ? PENDING_RED : color,
      });
      y -= size + gap;
    }
  };

  write(`${site.name} · ${site.tagline}`, {
    font: bold,
    size: 12,
    color: SAGE,
  });
  y -= 8;
  write(consentTitle, { font: bold, size: 16, gap: 14 });

  const rows: [string, string][] = [
    ["Nombre", consent.firstName],
    ["Apellidos", consent.lastName],
    ["Fecha de nacimiento", consent.birthDate.split("-").reverse().join("/")],
    ["DNI", consent.dni],
    ["Email", consent.email || "—"],
    ["Padre, madre o tutor", consent.guardian || "—"],
    ["Cómo nos ha conocido", consent.sources.join(", ")],
  ];
  for (const [label, value] of rows) write(`${label}: ${value}`);
  y -= 10;

  for (const clause of consentClauses) {
    write(clause, { size: 9, gap: 3 });
    y -= 3;
  }
  y -= 10;

  write(`[X] ${privacyLabel}`);
  write(`[${consent.marketing ? "X" : " "}] ${marketingLabel}`);
  y -= 10;

  const signer = consent.guardian || fullName;
  write(`Firmado por ${signer} el ${formatDate(signedAt)}.`, { font: bold });

  const scale = Math.min(220 / signature.width, 90 / signature.height, 1);
  const size = signature.scale(scale);
  if (y - size.height < MARGIN) {
    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.height - MARGIN;
  }
  page.drawImage(signature, {
    x: MARGIN,
    y: y - size.height - 6,
    width: size.width,
    height: size.height,
  });

  return pdf.save();
}
