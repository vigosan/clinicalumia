import { isValidPersonalId, normalizeTaxId } from "@clinicalumia/api/tax-id";

export const signatureMethodLabels = {
  drawn: "Firma dibujada",
  typed: "Firma escrita con el nombre",
} as const;

export type SignatureMethod = keyof typeof signatureMethodLabels;

export type Consent = {
  firstName: string;
  lastName: string;
  guardian: string;
  birthDate: string;
  dni: string;
  guardianDni: string;
  email: string;
  sources: string[];
  marketing: boolean;
  mediaForTraining: boolean;
  signature: string;
  signatureMethod: SignatureMethod;
};

export const consentSources = [
  "Familiares o amigos",
  "Web de LUMIA",
  "Internet (Google, etc.)",
  "Instagram u otras redes sociales",
  "Otros",
] as const;

const ADULT_AGE = 18;

export type PersonalIdCheck = "empty" | "valid" | "passport" | "invalid";

function normalizePersonalId(input: string): string {
  const id = normalizeTaxId(input.trim());
  return /^\d{7}[A-Z]$/.test(id) ? `0${id}` : id;
}

export function checkPersonalId(input: string): PersonalIdCheck {
  const id = normalizePersonalId(input);
  if (!id) return "empty";
  if (isValidPersonalId(id)) return "valid";
  if (/^(\d{7,8}|[XYZ]\d{7})[A-Z]?$/.test(id)) return "invalid";
  return /^[A-Z0-9]{5,15}$/.test(id) ? "passport" : "invalid";
}

export function consentFileName(
  consent: Pick<Consent, "dni">,
  signedAt: Date,
): string {
  const id = consent.dni.replace(/[^A-Za-z0-9]/g, "");
  const date = signedAt.toISOString().slice(0, 10);
  return id ? `consentimiento-${id}-${date}.pdf` : `consentimiento-${date}.pdf`;
}

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isSignatureMethod(value: string): value is SignatureMethod {
  return Object.hasOwn(signatureMethodLabels, value);
}

function ageOn(birthDate: Date, today: Date) {
  const age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const hadBirthday =
    today.getUTCMonth() > birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() &&
      today.getUTCDate() >= birthDate.getUTCDate());
  return hadBirthday ? age : age - 1;
}

function personalIdError(
  dni: string,
  guardianDni: string,
  minor: boolean,
): string | null {
  if (!minor && !dni) return "El DNI/NIE del paciente es obligatorio.";
  if (checkPersonalId(dni) === "invalid")
    return "El DNI/NIE del paciente no es válido. Revisa los números y la letra.";
  if (minor && !guardianDni)
    return "Si el paciente es menor, indica el DNI/NIE del padre, madre o tutor.";
  if (checkPersonalId(guardianDni) === "invalid")
    return "El DNI/NIE del padre, madre o tutor no es válido. Revisa los números y la letra.";
  return null;
}

export function parseConsent(
  formData: FormData,
  today: Date,
  { signedBeforeIdChecks = false } = {},
): { ok: true; consent: Consent } | { error: string } {
  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const guardianInput = text(formData, "guardian");
  const birthDate = text(formData, "birthDate");
  const dni = normalizePersonalId(text(formData, "dni"));
  const guardianDniInput = normalizePersonalId(text(formData, "guardianDni"));
  const email = text(formData, "email");
  const sources = formData.getAll("source").map(String);
  const signature = text(formData, "signature");
  const signatureMethod = text(formData, "signature_method") || "drawn";

  if (!firstName) return { error: "El nombre es obligatorio." };
  if (!lastName) return { error: "Los apellidos son obligatorios." };

  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    Number.isNaN(birth.getTime()) ||
    birth.toISOString().slice(0, 10) !== birthDate
  ) {
    return { error: "La fecha de nacimiento es obligatoria." };
  }
  if (birth > today) {
    return { error: "La fecha de nacimiento no puede ser futura." };
  }
  const minor = ageOn(birth, today) < ADULT_AGE;
  const guardian = minor ? guardianInput : "";
  if (minor && !guardian) {
    return {
      error:
        "Si el paciente es menor, indica el nombre del padre, madre o tutor.",
    };
  }
  const guardianDni = minor ? guardianDniInput : "";
  const idError = signedBeforeIdChecks
    ? !dni && !guardianDni && "El DNI es obligatorio."
    : personalIdError(dni, guardianDni, minor);
  if (idError) return { error: idError };

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "El email no es válido." };
  }
  if (sources.length === 0) {
    return { error: "Indica cómo te has enterado de nuestros servicios." };
  }
  if (formData.get("privacy") !== "on") {
    return { error: "Debes aceptar la política de privacidad." };
  }
  if (!isSignatureMethod(signatureMethod)) {
    return { error: "La forma de firmar no es válida." };
  }
  if (!signature.startsWith("data:image/png;base64,")) {
    return { error: "Falta la firma." };
  }

  return {
    ok: true,
    consent: {
      firstName,
      lastName,
      guardian,
      birthDate,
      dni,
      guardianDni,
      email,
      sources,
      marketing: formData.get("marketing") === "on",
      mediaForTraining: formData.get("mediaForTraining") === "on",
      signature,
      signatureMethod,
    },
  };
}
