import { createClient } from "@clinicalumia/api/server";

export default async function ReservarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <section className="px-6 py-14 md:px-12 md:py-20">
      <p data-testid="reservar-email" className="mx-auto max-w-md text-ink-600">
        {user?.email}
      </p>
    </section>
  );
}
