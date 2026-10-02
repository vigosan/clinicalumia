import { turnstileSiteKey } from "@/lib/turnstile";
import { AccessForm } from "./AccessForm";

export default async function AccederPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; caducado?: string }>;
}) {
  const { next, caducado } = await searchParams;

  return (
    <AccessForm
      next={next}
      caducado={caducado}
      turnstileSiteKey={turnstileSiteKey()}
    />
  );
}
