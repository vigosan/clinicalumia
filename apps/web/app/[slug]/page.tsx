import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PageHero } from "@/components/PageHero";
import { PillLink } from "@/components/PillLink";
import { pageMetadata } from "@/lib/metadata";
import { getServicePage, servicePages } from "@/lib/service-pages";
import { nearbyTowns, site } from "@/lib/site";

type Params = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return servicePages.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = getServicePage(slug);

  if (!page) {
    return {};
  }

  return pageMetadata({
    title: page.metaTitle,
    description: page.metaDescription,
    path: `/${page.slug}`,
  });
}

export default async function ServicePage({ params }: Params) {
  const { slug } = await params;
  const page = getServicePage(slug);

  if (!page) {
    notFound();
  }

  return (
    <>
      <PageHero
        eyebrow={
          <Breadcrumbs
            items={[
              { label: "Inicio", href: "/" },
              { label: "Servicios", href: "/servicios" },
              { label: page.title, href: `/${page.slug}` },
            ]}
          />
        }
        title={page.h1}
        intro={page.intro}
      >
        <PillLink href="/contacto" tone="cream">
          Solicita tu primera valoración
        </PillLink>
      </PageHero>

      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-bold text-card text-ink-600 tracking-tight md:text-section">
            {page.whatIsTitle}
          </h2>
          <p className="mt-5 text-ink-500 text-lg leading-relaxed">
            {page.whatIs}
          </p>
        </div>
      </section>

      <section className="px-6 pb-14 md:px-12 md:pb-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-bold text-card text-ink-600 tracking-tight md:text-section">
            Qué tratamos
          </h2>
          <div className="mt-8 flex flex-col">
            {page.treatments.map((treatment) => (
              <article
                key={treatment.name}
                className="border-sage-400/50 border-t py-8"
              >
                <h3 className="font-bold text-ink-600 text-xl">
                  {treatment.name}
                </h3>
                <p className="mt-3 text-ink-500 leading-relaxed">
                  {treatment.description}
                </p>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {treatment.signs.map((sign) => (
                    <li
                      key={sign}
                      className="rounded-full bg-sage-500/15 px-4 py-1.5 text-ink-600 text-sm"
                    >
                      {sign}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-14 md:px-12 md:pb-20">
        <div className="mx-auto max-w-6xl rounded-panel bg-sage-500 px-6 py-12 md:px-14 md:py-16">
          <h2 className="font-bold text-card text-cream-50 tracking-tight md:text-section">
            Señales de alerta o motivos de consulta
          </h2>
          <ul className="mt-8 grid gap-x-10 gap-y-3 md:grid-cols-2">
            {page.warningSigns.map((sign) => (
              <li
                key={sign}
                className="border-cream-50/30 border-b pb-3 text-cream-50"
              >
                {sign}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-6 pb-14 md:px-12 md:pb-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-bold text-card text-ink-600 tracking-tight md:text-section">
            Cómo trabajamos en {site.name}
          </h2>
          <ol className="mt-8 flex flex-col gap-8">
            {page.steps.map((step, index) => (
              <li key={step.title} className="flex gap-6">
                <span className="font-bold text-3xl text-sage-500 tabular-nums">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-bold text-ink-600 text-xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-ink-500 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-6 pb-14 md:px-12 md:pb-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-bold text-card text-ink-600 tracking-tight md:text-section">
            Beneficios del tratamiento
          </h2>
          <ul className="mt-6 grid gap-x-10 gap-y-3 md:grid-cols-2">
            {page.benefits.map((benefit) => (
              <li
                key={benefit}
                className="border-sage-400/50 border-b pb-3 text-ink-500"
              >
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-6 pb-20 md:px-12 md:pb-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <p className="font-bold text-card text-ink-600 tracking-tight md:text-section">
            {page.cta}
          </p>
          <PillLink href="/contacto">Pedir cita</PillLink>
          <p className="text-ink-400 text-sm">
            Atendemos pacientes de {site.city} y localidades cercanas como{" "}
            {nearbyTowns.join(", ")} y otros municipios de La Costera.
          </p>
        </div>
      </section>
    </>
  );
}
