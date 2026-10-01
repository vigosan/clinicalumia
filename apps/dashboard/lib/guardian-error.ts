export type GuardianErrorCode =
  | "minor-guardian"
  | "primary"
  | "already"
  | "unknown";

const MESSAGE_BY_CODE: Record<GuardianErrorCode, string> = {
  "minor-guardian": "El tutor/a tiene que ser mayor de edad.",
  primary: "Ya tiene tutor/a principal.",
  already: "Ya es tutor/a de este menor.",
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
