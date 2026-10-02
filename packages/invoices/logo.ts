import sharp from "sharp";

export const LOGO_MAX_WIDTH_PX = 600;

export async function shrinkLogo(
  bytes: Uint8Array,
  type: string,
): Promise<Uint8Array> {
  if (type === "image/svg+xml") return bytes;
  const { width } = await sharp(bytes).metadata();
  if (width <= LOGO_MAX_WIDTH_PX) return bytes;
  const resized = await sharp(bytes)
    .resize({ width: LOGO_MAX_WIDTH_PX })
    .toBuffer();
  return new Uint8Array(resized);
}
