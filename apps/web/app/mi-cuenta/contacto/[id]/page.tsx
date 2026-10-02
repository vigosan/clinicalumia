import { createClient } from "@clinicalumia/api/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import { isTeamSession } from "@/lib/booking";
import { pageMetadata } from "@/lib/metadata";
import { TeamSession } from "../../../reservar/TeamSession";
import { requirePatientPage } from "../../session";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Datos de contacto · Clínica LUMIA en Xàtiva",
    description: "Cambia el teléfono y la dirección en LUMIA.",
    path: "/mi-cuenta",
  }),
  robots: { index: false },
};

export default async function ContactoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePatientPage(`/mi-cuenta/contacto/${id}`);

  const supabase = await createClient();
  const { data: people, error } = await supabase.rpc("my_people");
  if (isTeamSession(error)) return <TeamSession />;
  if (error) throw error;
  const person = people.find((candidate) => candidate.id === id);
  if (!person) notFound();

  const { data: contact, error: contactError } = await supabase.rpc(
    "my_contact",
    { p_person_id: id },
  );
  if (contactError) throw contactError;

  return (
    <>
      <PageHero />
      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-bold text-ink-600 text-section">
            Datos de contacto
          </h1>
          <p className="mt-3 text-ink-500">
            {person.first_name} {person.last_name}
          </p>
          <ContactForm
            personId={id}
            phone={contact[0]?.phone ?? ""}
            address={contact[0]?.address ?? ""}
            phoneRequired={!person.is_minor}
          />
          <Link
            href="/mi-cuenta"
            className="mt-8 inline-block font-medium text-sage-600 underline-offset-2 hover:underline"
          >
            Volver a Mi cuenta
          </Link>
        </div>
      </section>
    </>
  );
}
