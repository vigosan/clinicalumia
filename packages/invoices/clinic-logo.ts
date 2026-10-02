import type { createClient } from "@clinicalumia/api/server";

type Client = Awaited<ReturnType<typeof createClient>>;

const LOGO_TIMEOUT_MS = 3000;

function isPngOrJpeg(bytes: Uint8Array): boolean {
  const png = [0x89, 0x50, 0x4e, 0x47].every(
    (byte, index) => bytes[index] === byte,
  );
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  return png || jpeg;
}

export async function clinicLogo(
  supabase: Client,
): Promise<Uint8Array | undefined> {
  const { data } = await supabase
    .from("clinic_settings")
    .select("logo_path")
    .maybeSingle();
  if (!data?.logo_path) return undefined;
  const { publicUrl } = supabase.storage
    .from("branding")
    .getPublicUrl(data.logo_path).data;
  const response = await fetch(publicUrl, {
    signal: AbortSignal.timeout(LOGO_TIMEOUT_MS),
  }).catch(() => null);
  if (!response?.ok) return undefined;
  const bytes = new Uint8Array(await response.arrayBuffer());
  return isPngOrJpeg(bytes) ? bytes : undefined;
}
