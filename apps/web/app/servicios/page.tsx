import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/CtaBand";
import { ArrowRightIcon } from "@/components/icons";
import { PageHero } from "@/components/PageHero";
import { PillLink } from "@/components/PillLink";
import { pageMetadata } from "@/lib/metadata";
import { type Service, services } from "@/lib/services";
import { nearbyTowns, site } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({
    title:
      "Servicios de logopedia, psicología y fisioterapia en Xàtiva · LUMIA",
    description:
      "Terapia miofuncional orofacial, logopedia infantil, logopedia para adultos, rehabilitación vocal, psicología y fisioterapia en Xàtiva. Tratamientos personalizados y enfoque funcional.",
    path: "/servicios",
  }),
};

const speechTherapy = services.slice(0, 5);
const alsoAtLumia = services.slice(5);

const groupTitle = "mb-6 font-bold text-2xl text-ink-900";

function ServiceCard({ service }: { service: Service }) {
  return (
    <Link
      href={`/${service.slug}`}
      data-testid="service-card"
      className="flex flex-col gap-4 rounded-[2rem] bg-white p-8 transition-shadow hover:shadow-[0_12px_32px_rgb(58_58_58/0.08)] md:p-9"
    >
      <span className="font-bold text-[1.75rem] text-ink-900 leading-tight tracking-tight">
        {service.title}
      </span>
      <span className="text-ink-800 text-lg leading-relaxed">
        {service.summary}
      </span>
      <span className="flex flex-wrap gap-1.5">
        {service.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-cream-100 px-3 py-1 text-ink-900 text-sm"
          >
            {tag}
          </span>
        ))}
      </span>
      <span className="mt-auto inline-flex items-center gap-2 pt-2 font-medium text-sage-800">
        Ver tratamiento
        <ArrowRightIcon className="size-5" />
      </span>
    </Link>
  );
}

export default function ServiciosPage() {
  return (
    <>
      <PageHero />

      <section className="px-6 pt-16 md:px-12 md:pt-24">
        <div className="mx-auto max-w-6xl">
          <p className="font-medium text-sage-800 text-sm uppercase tracking-[0.08em]">
            Tratamientos
          </p>
          <h1 className="mt-4 max-w-3xl font-bold text-[2.5rem] text-ink-900 leading-[1.04] tracking-tight md:text-[4.25rem]">
            Tratamos el origen, no solo el síntoma.
          </h1>
          <p className="mt-6 max-w-2xl text-ink-800 text-lg leading-relaxed md:text-xl">
            En {site.name} abordamos la logopedia, la terapia miofuncional, la
            psicología y la fisioterapia desde una visión global: evaluamos
            funciones, detectamos patrones alterados y diseñamos tratamientos
            adaptados a cada paciente.
          </p>
        </div>
      </section>

      <section className="px-6 pt-14 md:px-12 md:pt-20">
        <div className="mx-auto max-w-6xl">
          <h2 className={groupTitle}>Logopedia y terapia miofuncional</h2>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {speechTherapy.map((service) => (
              <ServiceCard key={service.number} service={service} />
            ))}
            <div
              data-testid="service-unsure"
              className="flex flex-col gap-4 rounded-[2rem] bg-sage-100 p-8 md:p-9"
            >
              <h3 className="font-bold text-[1.75rem] text-ink-900 leading-tight tracking-tight">
                ¿No sabes cuál es el tuyo?
              </h3>
              <p className="text-ink-900 text-lg leading-relaxed">
                Empezamos con una valoración para identificar el origen del
                problema y elegir el tratamiento adecuado.
              </p>
              <div className="mt-auto pt-2">
                <PillLink href="/reservar" tone="solid">
                  Pide tu primera valoración
                </PillLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pt-14 md:px-12 md:pt-20">
        <div className="mx-auto max-w-6xl">
          <h2 className={groupTitle}>También en LUMIA</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {alsoAtLumia.map((service) => (
              <ServiceCard key={service.number} service={service} />
            ))}
          </div>
        </div>
      </section>

      <CtaBand>
        <p className="text-ink-900 text-lg">
          Atendemos en {site.city} y en {nearbyTowns.join(", ")} y otros
          municipios de La Costera.
        </p>
      </CtaBand>
    </>
  );
}
