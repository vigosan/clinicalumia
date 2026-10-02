import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/PageHero";
import { isTeamSession, personError } from "@/lib/booking";
import { pageMetadata } from "@/lib/metadata";
import { loadPeople, loadPrivacyAccepted } from "../../../reservar/load";
import { NewPersonForm } from "../../../reservar/NewPersonForm";
import { possibleGuardians } from "../../../reservar/step";
import { TeamSession } from "../../../reservar/TeamSession";
import { addMinor } from "../../personas/actions";
import { requirePatientPage } from "../../session";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Añadir un menor · Clínica LUMIA en Xàtiva",
    description: "Añade a tu cuenta de LUMIA a un menor a tu cargo.",
    path: "/mi-cuenta",
  }),
  robots: { index: false },
};

export default async function NuevoMenorPage({
  searchParams,
}: {
  searchParams: Promise<{ aviso?: string | string[] }>;
}) {
  const { aviso } = await searchParams;
  await requirePatientPage("/mi-cuenta/menores/nuevo");

  const loaded = await Promise.all([loadPeople(), loadPrivacyAccepted()]).catch(
    (error) => {
      if (isTeamSession(error)) return null;
      throw error;
    },
  );
  if (!loaded) return <TeamSession />;
  const [people, privacyAccepted] = loaded;

  return (
    <>
      <PageHero />
      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="mb-8 font-bold text-ink-600 text-section">
            Añadir un menor
          </h1>
          <NewPersonForm
            estado=""
            needsPrivacy={!privacyAccepted}
            guardians={possibleGuardians(people).map((guardian) => ({
              id: guardian.id,
              name: `${guardian.first_name} ${guardian.last_name}`,
            }))}
            today={todayInMadrid()}
            warning={
              typeof aviso === "string" ? personError({ message: aviso }) : null
            }
            action={addMinor}
            minorOnly
            errorTestId="account-error"
          />
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
