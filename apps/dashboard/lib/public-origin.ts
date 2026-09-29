export function publicOrigin(headers: Headers): string {
  const host =
    headers.get("x-forwarded-host") ??
    headers.get("host") ??
    "panel.clinicalumia.es";
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0];
  const proto =
    forwardedProto?.trim() || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
