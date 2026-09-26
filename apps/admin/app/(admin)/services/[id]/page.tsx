import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { notFound } from "next/navigation";
import { ServiceForm } from "../ServiceForm";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: specialties }, { data: service }] = await Promise.all([
    supabase.from("specialties").select("id, name").order("name"),
    supabase
      .from("services")
      .select(
        "id, specialty_id, name, duration_minutes, price_cents, vat, bookable_online, booking_payment, booking_payment_value, cancellation_hours",
      )
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!service) notFound();
  return (
    <>
      <PageHeader title="Editar servicio" description={service.name} />
      <Card>
        <ServiceForm specialties={specialties ?? []} service={service} />
      </Card>
    </>
  );
}
