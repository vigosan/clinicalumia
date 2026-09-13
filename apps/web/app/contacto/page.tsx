import type { Metadata } from "next";
import { GoogleIcon } from "@/components/icons";
import { PageHero } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";
import { isPending, nearbyTowns, site } from "@/lib/site";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Contacto · Clínica LUMIA en Xàtiva",
    description:
      "Pide tu primera valoración en LUMIA. Contacta por teléfono, WhatsApp o formulario con nuestra clínica de logopedia y terapia miofuncional en Xàtiva.",
    path: "/contacto",
  }),
};

export default function ContactoPage() {
  const hasAddress = !isPending(site.address.street);
  const hasEmail = !isPending(site.email);
  const hasSchedule = !isPending(site.schedule[0].days);
  const hasMaps = !isPending(site.maps);

  return (
    <>
      <PageHero
        title="Estamos aquí para ayudarte"
        intro="Si tienes dudas o quieres realizar una primera valoración, puedes contactar con LUMIA por teléfono o formulario. Te orientaremos sobre el primer paso más adecuado según tu caso."
      />

      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[3fr_2fr] md:gap-20">
          <div>
            <h2 className="font-bold text-card text-ink-600 tracking-tight md:text-section">
              Cuéntanos tu caso
            </h2>
            <p className="mt-3 mb-8 text-ink-500">
              Cuéntanos brevemente qué necesitas y te contactaremos para
              orientarte.
            </p>
            <ContactForm />
          </div>

          <aside className="flex flex-col gap-8">
            <div>
              <h3 className="font-bold text-ink-600 text-lg">Teléfono</h3>
              <a
                href={site.phone.href}
                className="mt-2 inline-block text-ink-500 underline-offset-2 hover:underline"
              >
                {site.phone.display}
              </a>
            </div>

            {hasEmail && (
              <div>
                <h3 className="font-bold text-ink-600 text-lg">Email</h3>
                <a
                  href={`mailto:${site.email}`}
                  className="mt-2 inline-block text-ink-500 underline-offset-2 hover:underline"
                >
                  {site.email}
                </a>
              </div>
            )}

            <div>
              <h3 className="font-bold text-ink-600 text-lg">Dirección</h3>
              <p className="mt-2 text-ink-500">
                {hasAddress
                  ? `${site.address.street}, ${site.address.postalCode} ${site.address.locality}`
                  : "Dirección pendiente de confirmar"}
              </p>
              {hasMaps && (
                <a
                  href={site.maps}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 font-medium text-sage-600 transition-opacity hover:opacity-70"
                >
                  Cómo llegar con Google Maps
                  <GoogleIcon className="size-5" />
                </a>
              )}
            </div>

            <div>
              <h3 className="font-bold text-ink-600 text-lg">Horario</h3>
              <p className="mt-2 text-ink-500">
                {hasSchedule
                  ? `${site.schedule[0].days}: ${site.schedule[0].hours}`
                  : "Horario pendiente de confirmar"}
              </p>
            </div>

            <div>
              <h3 className="font-bold text-ink-600 text-lg">
                Zona de atención
              </h3>
              <p className="mt-2 text-ink-500 leading-relaxed">
                Atendemos pacientes de {site.city} y localidades cercanas como{" "}
                {nearbyTowns.join(", ")} y otros municipios de La Costera.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
