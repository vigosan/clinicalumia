import { createClient } from "@clinicalumia/api/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { formatWhen, isTeamSession } from "@/lib/booking";
import { pageMetadata } from "@/lib/metadata";
import { TeamSession } from "../TeamSession";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Cita confirmada · Clínica LUMIA en Xàtiva",
    description: "Tu cita en LUMIA está reservada.",
    path: "/reservar/confirmada",
  }),
  robots: { index: false },
};

export default async function ConfirmadaPage({
  searchParams,
}: {
  searchParams: Promise<{ cita?: string | string[] }>;
}) {
  const { cita } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (typeof cita !== "string" || !user) notFound();

  const { data, error } = await supabase.rpc("my_appointments");
  if (isTeamSession(error)) return <TeamSession />;
  if (error) throw error;
  const appointment = data.find((candidate) => candidate.id === cita);
  if (!appointment) notFound();

  return (
    <>
      <PageHero />
      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-bold text-ink-900 text-section">
            Cita confirmada
          </h1>
          <p className="mt-3 mb-8 text-ink-800">
            Te hemos enviado la confirmación a {user.email}.
          </p>
          <dl
            data-testid="booking-confirmed"
            className="flex flex-col gap-3 rounded-3xl bg-cream-50 px-6 py-5 text-ink-800"
          >
            <div>
              <dt className="text-ink-800 text-sm">Cuándo</dt>
              <dd className="font-bold">{formatWhen(appointment.starts_at)}</dd>
            </div>
            <div>
              <dt className="text-ink-800 text-sm">Servicio</dt>
              <dd>{appointment.service_name}</dd>
            </div>
            <div>
              <dt className="text-ink-800 text-sm">Te atenderá</dt>
              <dd data-testid="booking-confirmed-professional">
                {appointment.professional_name}
              </dd>
            </div>
            <div>
              <dt className="text-ink-800 text-sm">Para</dt>
              <dd>{appointment.person_name}</dd>
            </div>
          </dl>
          <a
            href={`/mi-cuenta/citas/${appointment.id}/cita.ics`}
            data-testid="booking-add-to-calendar"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-sage-800 px-6 text-cream-50 transition-colors hover:bg-sage-900"
          >
            Añadir a mi calendario
          </a>
          <p className="mt-8 text-ink-800">
            Puedes verla o cambiarla en{" "}
            <Link
              href="/mi-cuenta"
              className="font-medium text-sage-800 underline-offset-2 hover:underline"
            >
              Mi cuenta
            </Link>
            .
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex h-11 items-center rounded-full border-2 border-sage-500 px-6 text-sage-800 transition-colors hover:bg-sage-500 hover:text-cream-50"
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    </>
  );
}
