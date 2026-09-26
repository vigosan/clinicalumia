export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const LOGO_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

export function validateLogoFile(file: File): { error: string } | { ok: true } {
  if (!LOGO_EXTENSIONS[file.type])
    return { error: "El logo debe ser PNG, JPG, WebP o SVG." };
  if (file.size > LOGO_MAX_BYTES)
    return { error: "El logo no puede pesar más de 2 MB." };
  return { ok: true };
}
