export type ConsentLinkErrorCode =
  | "permission"
  | "person-not-found"
  | "consent-not-found"
  | "already-linked"
  | "unknown";

export const CONSENT_LINK_ERROR_MESSAGES: Record<ConsentLinkErrorCode, string> =
  {
    permission: "No tienes permiso para hacer esto.",
    "person-not-found": "Esa ficha ya no existe o está archivada.",
    "consent-not-found": "Ese consentimiento ya no existe.",
    "already-linked": "Este consentimiento ya está asociado.",
    unknown: "No se ha podido guardar.",
  };

export function consentLinkErrorCode(message: string): ConsentLinkErrorCode {
  const match = (
    Object.entries(CONSENT_LINK_ERROR_MESSAGES) as [
      ConsentLinkErrorCode,
      string,
    ][]
  ).find(([, text]) => text === message);
  return match ? match[0] : "unknown";
}

export function consentLinkErrorMessage(
  code: string | undefined,
): string | undefined {
  if (!code) return undefined;
  return (CONSENT_LINK_ERROR_MESSAGES as Record<string, string>)[code];
}
