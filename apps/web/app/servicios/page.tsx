import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { PillLink } from "@/components/PillLink";
import { ServiceList } from "@/components/ServiceList";
import { pageMetadata } from "@/lib/metadata";
import { services } from "@/lib/services";
import { nearbyTowns, site } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Servicios de logopedia y terapia miofuncional en Xàtiva · LUMIA",
    description:
      "Terapia miofuncional orofacial, logopedia infantil, logopedia para adultos y rehabilitación vocal en Xàtiva. Tratamientos personalizados y enfoque funcional.",
    path: "/servicios",
  }),
};

export default function ServiciosPage() {
  return (
    <>
      <PageHero />

      <section className="px-6 pt-12 md:px-12 md:pt-16">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-bold text-ink-600 text-section">
            Tratamientos de logopedia y terapia miofuncional
          </h1>
          <p className="mt-6 max-w-[46ch] text-ink-500 text-lg leading-relaxed">
            En LUMIA abordamos la logopedia y la terapia miofuncional desde una
            visión global. No tratamos solo síntomas: evaluamos funciones,
            detectamos patrones alterados y diseñamos tratamientos adaptados a
            cada paciente.
          </p>
        </div>
      </section>

      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-6xl">
          <ServiceList items={services} />
        </div>
      </section>

      <section className="px-6 pb-20 md:px-12 md:pb-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="font-bold text-card text-ink-600 tracking-tight md:text-section">
            Dar el primer paso también forma parte del tratamiento
          </h2>
          <p className="text-ink-500 text-lg leading-relaxed">
            Solicita una primera valoración personalizada en nuestra clínica de
            logopedia y terapia miofuncional en {site.city}.
          </p>
          <PillLink href="/contacto">Solicita tu primera valoración</PillLink>
          <p className="text-ink-400 text-sm">
            Atendemos pacientes de {site.city} y localidades cercanas como{" "}
            {nearbyTowns.join(", ")} y otros municipios de La Costera.
          </p>
        </div>
      </section>
    </>
  );
}
