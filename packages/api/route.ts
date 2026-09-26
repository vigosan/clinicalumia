import type { MfaStep } from "./mfa";

const PUBLIC = ["/login", "/auth/confirm"];
const ENROLL_ALLOWED = ["/auth/dos-pasos/activar", "/auth/contrasena"];
const CONFIRM = ["/auth/confirm"];
const DOS_PASOS = ["/auth/dos-pasos"];

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

function hasControlChar(value: string) {
  return Array.from(value).some((char) => char.charCodeAt(0) < 0x20);
}

export function safeNext(value: string | null): string {
  if (
    !value?.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/\\") ||
    hasControlChar(value)
  )
    return "/";
  return value;
}

export function nextRoute({
  path,
  search,
  signedIn,
  step,
}: {
  path: string;
  search: string;
  signedIn: boolean;
  step: MfaStep | null;
}): { redirect: string } | null {
  if (!signedIn || !step)
    return startsWithAny(path, PUBLIC) ? null : { redirect: "/login" };

  if (step === "enroll")
    return startsWithAny(path, ENROLL_ALLOWED) || startsWithAny(path, CONFIRM)
      ? null
      : { redirect: "/auth/dos-pasos/activar" };

  if (step === "challenge") {
    if (path === "/auth/dos-pasos" || startsWithAny(path, CONFIRM)) return null;
    return {
      redirect: `/auth/dos-pasos?next=${encodeURIComponent(path + search)}`,
    };
  }

  if (path === "/login" || startsWithAny(path, DOS_PASOS))
    return { redirect: "/" };
  return null;
}
