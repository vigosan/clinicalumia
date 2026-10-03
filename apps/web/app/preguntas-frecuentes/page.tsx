import type { Metadata } from "next";
import { FaqAccordion } from "@/components/FaqAccordion";
import { PageHero } from "@/components/PageHero";
import { PillLink, pillClassName } from "@/components/PillLink";
import { faqs, faqTopics } from "@/lib/faqs";
import { pageMetadata } from "@/lib/metadata";
import { isPending, site } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({
    title:
      "Preguntas frecuentes sobre logopedia y terapia miofuncional · LUMIA",
    description:
      "Resolvemos las dudas más habituales sobre logopedia, terapia miofuncional, respiración oral, deglución atípica y cuándo acudir a un logopeda en Xàtiva.",
    path: "/preguntas-frecuentes",
  }),
};

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

export default function PreguntasFrecuentesPage() {
  return (
    <>
      <PageHero />

      <section className="px-6 pt-16 md:px-12 md:pt-24">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-bold text-[2.5rem] text-ink-900 leading-[1.04] tracking-tight md:text-[4.25rem]">
            Preguntas frecuentes
          </h1>
          <p className="mt-6 max-w-2xl text-ink-800 text-lg leading-relaxed md:text-xl">
            Resolvemos las dudas más habituales sobre logopedia, terapia
            miofuncional y funciones orofaciales. Si no encuentras tu caso,
            cuéntanoslo y te orientamos.
          </p>
        </div>
      </section>

      <section className="px-6 pt-14 pb-24 md:px-12 md:pt-20 md:pb-32">
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[14rem_1fr] md:gap-16">
          <nav
            aria-label="Temas"
            className="flex flex-wrap gap-2 md:flex-col md:gap-1"
          >
            {faqTopics.map((topic) => (
              <a
                key={topic.id}
                href={`#${topic.id}`}
                className="rounded-2xl bg-cream-200 px-4 py-3 font-medium text-ink-900 transition-colors hover:bg-sage-100 md:bg-transparent"
              >
                {topic.label}
              </a>
            ))}
          </nav>

          <div className="flex min-w-0 flex-col gap-14">
            {faqTopics.map((topic) => (
              <section
                key={topic.id}
                id={topic.id}
                aria-labelledby={`${topic.id}-titulo`}
                className="scroll-mt-8"
              >
                <h2
                  id={`${topic.id}-titulo`}
                  className="mb-2 font-bold text-2xl text-ink-900"
                >
                  {topic.label}
                </h2>
                <FaqAccordion
                  items={faqs.filter((faq) => faq.topic === topic.id)}
                />
              </section>
            ))}

            <div className="flex flex-col gap-6 rounded-[2rem] bg-sage-100 p-8 md:flex-row md:items-center md:justify-between md:p-10">
              <div className="flex flex-col gap-1.5">
                <h2 className="font-bold text-2xl text-ink-900">
                  ¿No encuentras tu caso?
                </h2>
                <p className="text-ink-900 text-lg">
                  Cuéntanoslo y te orientamos sobre el primer paso.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <PillLink href="/contacto" tone="solid">
                  Cuéntanos tu caso
                </PillLink>
                {!isPending(site.whatsapp.href) && (
                  <a
                    href={site.whatsapp.href}
                    className={pillClassName("sage")}
                  >
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload is a static, server-controlled object
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </>
  );
}
