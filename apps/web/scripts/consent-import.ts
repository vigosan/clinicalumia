import type { createAdminClient } from "@clinicalumia/api/admin";
import { madridInstant } from "@clinicalumia/api/madrid-time";
import { extractText } from "unpdf";
import {
  type Consent,
  consentSources,
  parseConsent,
  signatureMethodLabels,
} from "@/lib/consent";
import { consentTitle } from "@/lib/consent-legal";
import { matchConsentPerson, storeConsent } from "@/lib/consent-store";

type AdminClient = ReturnType<typeof createAdminClient>;
type LinkMethod = NonNullable<
  Awaited<ReturnType<typeof matchConsentPerson>>
>["method"];

const FIELDS = {
  Nombre: "firstName",
  Apellidos: "lastName",
  "Fecha de nacimiento": "birthDate",
  DNI: "dni",
  "DNI/NIE del paciente": "dni",
  "DNI/NIE del padre, madre o tutor": "guardianDni",
  Email: "email",
  "Padre, madre o tutor": "guardian",
} as const;

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const FIELD_LINE = new RegExp(`^(${Object.keys(FIELDS).join("|")}): (.*)$`);
const CHECKBOX_LINE = /^\[([X ])\] (.*)$/;
const SIGNED_LINE = "Firmado por ";
const SOURCES_LABEL = "Cómo nos ha conocido: ";
const SIGNED_DATE =
  / el (\d{1,2}) de (\p{L}+) de (\d{4})(?:,| a las) (\d{1,2}):(\d{2})\.$/u;
const EMPTY = "—";
const MARKETING = "Acepto recibir";
const MEDIA = "Autorizo el uso";

export async function readPdfText(pdf: Uint8Array) {
  const { text } = await extractText(pdf.slice(), { mergePages: true });
  return text;
}

function splitSources(value: string) {
  const sources: string[] = [];
  let rest = value;
  while (rest) {
    const source = consentSources.find(
      (option) => rest === option || rest.startsWith(`${option}, `),
    );
    if (!source) return null;
    sources.push(source);
    rest = rest.slice(source.length + 2);
  }
  return sources;
}

function parseSignedAt(line: string) {
  const match = SIGNED_DATE.exec(line);
  if (!match) return null;
  const [, day = "", monthName = "", year = "", hour = "", minute = ""] = match;
  const month = MONTHS.indexOf(monthName.toLowerCase()) + 1;
  if (month === 0) return null;
  const date = `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
  try {
    return new Date(madridInstant(date, `${hour.padStart(2, "0")}:${minute}`));
  } catch {
    return null;
  }
}

function blocks(lines: string[], start: RegExp) {
  const found: string[] = [];
  for (const line of lines) {
    if (start.test(line)) found.push(line);
    else if (found.length > 0) found[found.length - 1] += ` ${line}`;
  }
  return found;
}

export function parseConsentText(
  text: string,
): { ok: true; consent: Consent; signedAt: Date } | { error: string } {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines.indexOf(consentTitle);
  const sourcesLine = lines.findIndex(
    (line, index) => index > title && line.startsWith(SOURCES_LABEL),
  );
  const signed = lines.findIndex(
    (line, index) => index > sourcesLine && line.startsWith(SIGNED_LINE),
  );
  if (title === -1 || sourcesLine === -1 || signed === -1) {
    return { error: "No es un consentimiento." };
  }

  const values: Partial<Record<(typeof FIELDS)[keyof typeof FIELDS], string>> =
    {};
  for (const block of blocks(lines.slice(title + 1, sourcesLine), FIELD_LINE)) {
    const [, label, value = ""] = FIELD_LINE.exec(block) ?? [];
    values[FIELDS[label as keyof typeof FIELDS]] = value === EMPTY ? "" : value;
  }

  let fieldsEnd = sourcesLine + 1;
  let sourcesText = lines[sourcesLine]?.slice(SOURCES_LABEL.length) ?? "";
  while (!splitSources(sourcesText) && fieldsEnd < signed) {
    sourcesText += ` ${lines[fieldsEnd]}`;
    fieldsEnd++;
  }
  const sources = splitSources(sourcesText);
  if (!sources) return { error: "Origen desconocido." };

  const boxes = blocks(lines.slice(fieldsEnd, signed), CHECKBOX_LINE).map(
    (block) => {
      const [, mark = "", label = ""] = CHECKBOX_LINE.exec(block) ?? [];
      return { checked: mark === "X", label };
    },
  );
  const checked = (prefix: string) =>
    boxes.some((box) => box.checked && box.label.startsWith(prefix));
  const privacy = boxes.find(
    (box) => !box.label.startsWith(MARKETING) && !box.label.startsWith(MEDIA),
  );

  const methodLabels: string[] = Object.values(signatureMethodLabels);
  const signedAt = parseSignedAt(
    lines
      .slice(signed)
      .filter((line) => !methodLabels.includes(line))
      .join(" "),
  );
  if (!signedAt) return { error: "Sin fecha de firma." };

  const [day, month, year] = (values.birthDate ?? "").split("/");
  const formData = new FormData();
  formData.set("firstName", values.firstName ?? "");
  formData.set("lastName", values.lastName ?? "");
  formData.set("guardian", values.guardian ?? "");
  formData.set("birthDate", `${year}-${month}-${day}`);
  formData.set("dni", values.dni ?? "");
  formData.set("guardianDni", values.guardianDni ?? "");
  formData.set("email", values.email ?? "");
  for (const source of sources) formData.append("source", source);
  if (privacy?.checked) formData.set("privacy", "on");
  if (checked(MARKETING)) formData.set("marketing", "on");
  if (checked(MEDIA)) formData.set("mediaForTraining", "on");
  formData.set("signature", "data:image/png;base64,");
  if (lines.includes(signatureMethodLabels.typed)) {
    formData.set("signature_method", "typed");
  }

  const result = parseConsent(formData, signedAt, {
    signedBeforeIdChecks: true,
  });
  if ("error" in result) return result;
  return { ok: true, consent: result.consent, signedAt };
}

export type ImportSummary = {
  total: number;
  imported: number;
  linked: Partial<Record<LinkMethod, number>>;
  pending: number;
  repeated: number;
  unreadable: number[];
  failed: number[];
};

async function alreadyStored(
  admin: AdminClient,
  consent: Consent,
  signedAt: Date,
) {
  const { data, error } = await admin
    .from("consents")
    .select("id")
    .eq(
      consent.dni ? "tax_id" : "guardian_tax_id",
      consent.dni || consent.guardianDni,
    )
    .gte("signed_at", signedAt.toISOString())
    .lt("signed_at", new Date(signedAt.getTime() + 60_000).toISOString())
    .limit(1);
  if (error) throw new Error(error.message);
  return data.length > 0;
}

export async function importConsents({
  admin,
  pdfs,
  dry,
}: {
  admin: AdminClient;
  pdfs: Uint8Array[];
  dry: boolean;
}): Promise<ImportSummary> {
  const summary: ImportSummary = {
    total: pdfs.length,
    imported: 0,
    linked: {},
    pending: 0,
    repeated: 0,
    unreadable: [],
    failed: [],
  };
  const seen = new Set<string>();

  for (const [index, pdf] of pdfs.entries()) {
    const position = index + 1;
    let parsed: ReturnType<typeof parseConsentText>;
    try {
      parsed = parseConsentText(await readPdfText(pdf));
    } catch {
      parsed = { error: "No se puede leer." };
    }
    if (!("ok" in parsed)) {
      summary.unreadable.push(position);
      continue;
    }
    const { consent, signedAt } = parsed;

    try {
      const key = `${consent.dni}|${consent.guardianDni}|${signedAt.toISOString()}`;
      if (seen.has(key) || (await alreadyStored(admin, consent, signedAt))) {
        summary.repeated++;
        continue;
      }
      seen.add(key);

      const method = dry
        ? ((await matchConsentPerson(admin, consent))?.method ?? null)
        : (await storeConsent({ admin, consent, signedAt, pdf })).method;
      summary.imported++;
      if (method) summary.linked[method] = (summary.linked[method] ?? 0) + 1;
      else summary.pending++;
    } catch {
      summary.failed.push(position);
    }
  }

  return summary;
}
