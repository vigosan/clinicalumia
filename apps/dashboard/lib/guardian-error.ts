export type GuardianErrorCode =
  | "minor-guardian"
  | "primary"
  | "already"
  | "unknown";

const MESSAGE_BY_CODE: Record<GuardianErrorCode, string> = {
  "minor-guardian": "Un tutor tiene que ser mayor de edad.",
  primary: "Ya tiene un tutor principal.",
  already: "Ya es tutor de este menor.",
  unknown: "No se ha podido guardar.",
};

export function guardianErrorCode(message: string): GuardianErrorCode {
  if (message === MESSAGE_BY_CODE["minor-guardian"]) return "minor-guardian";
  if (message === MESSAGE_BY_CODE.primary) return "primary";
  if (message === MESSAGE_BY_CODE.already) return "already";
  return "unknown";
}

export function guardianErrorMessage(
  code: string | undefined,
): string | undefined {
  if (!code) return undefined;
  return (MESSAGE_BY_CODE as Record<string, string>)[code];
}
