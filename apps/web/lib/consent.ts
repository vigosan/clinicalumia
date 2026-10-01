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

export function parseConsent(
  formData: FormData,
  today: Date,
): { ok: true; consent: Consent } | { error: string } {
  const firstName = text(formData, "firstName");
  const lastName = text(formData, "lastName");
  const guardian = text(formData, "guardian");
  const birthDate = text(formData, "birthDate");
  const dni = text(formData, "dni")
    .toUpperCase()
    .replace(/[\s.-]/g, "");
  const email = text(formData, "email");
  const sources = formData.getAll("source").map(String);
  const signature = text(formData, "signature");
  const signatureMethod = text(formData, "signature_method") || "drawn";

  if (!firstName) return { error: "El nombre es obligatorio." };
  if (!lastName) return { error: "Los apellidos son obligatorios." };
  if (!dni) return { error: "El DNI es obligatorio." };

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
  if (ageOn(birth, today) < ADULT_AGE && !guardian) {
    return {
      error:
        "Si el paciente es menor, indica el nombre del padre, madre o tutor.",
    };
  }

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
      email,
      sources,
      marketing: formData.get("marketing") === "on",
      mediaForTraining: formData.get("mediaForTraining") === "on",
      signature,
      signatureMethod,
    },
  };
}
