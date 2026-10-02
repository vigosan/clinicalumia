import { createClient } from "@clinicalumia/api/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { changeWindowText } from "@/lib/account";
import { formatWhen, isTeamSession } from "@/lib/booking";
import { pageMetadata } from "@/lib/metadata";
import { TeamSession } from "../../../../reservar/TeamSession";
import { requirePatientPage } from "../../../session";
import { CancelForm } from "./CancelForm";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Cancelar cita · Clínica LUMIA en Xàtiva",
    description: "Cancela tu cita en LUMIA.",
    path: "/mi-cuenta",
  }),
  robots: { index: false },
};

export default async function CancelarCitaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePatientPage(`/mi-cuenta/citas/${id}/cancelar`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_appointments");
  if (isTeamSession(error)) return <TeamSession />;
  if (error) throw error;
  const appointment = data.find(
    (candidate) => candidate.id === id && candidate.status === "scheduled",
  );
  if (!appointment) notFound();

  return (
    <>
      <PageHero />
      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-bold text-ink-600 text-section">Cancelar cita</h1>
          <div
            data-testid="cancel-summary"
            className="mt-8 rounded-3xl bg-cream-50 px-6 py-5 text-ink-800"
          >
            <p className="font-bold">{formatWhen(appointment.starts_at)}</p>
            <p className="mt-1">
              {appointment.service_name} · {appointment.professional_name}
            </p>
            <p className="mt-1 text-ink-800">Para {appointment.person_name}</p>
            <p className="mt-3 text-ink-800 text-sm">
              {changeWindowText(appointment)}
            </p>
          </div>
          {appointment.can_change && <CancelForm appointmentId={id} />}
          <Link
            href="/mi-cuenta"
            className="mt-8 inline-block font-medium text-sage-800 underline-offset-2 hover:underline"
          >
            Volver a Mi cuenta
          </Link>
        </div>
      </section>
    </>
  );
}
