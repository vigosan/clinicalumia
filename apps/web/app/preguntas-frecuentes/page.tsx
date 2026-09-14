import type { Metadata } from "next";
import { FaqAccordion } from "@/components/FaqAccordion";
import { PageHero } from "@/components/PageHero";
import { PillLink } from "@/components/PillLink";
import { faqs } from "@/lib/faqs";
import { pageMetadata } from "@/lib/metadata";

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

      <section className="px-6 pt-12 md:px-12 md:pt-16">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-bold text-ink-600 text-section">
            Preguntas frecuentes
          </h1>
          <p className="mt-6 max-w-[46ch] text-ink-500 text-lg leading-relaxed">
            Resolvemos las dudas más habituales sobre logopedia, terapia
            miofuncional y funciones orofaciales. Si no encuentras tu caso,
            cuéntanoslo y te orientamos.
          </p>
        </div>
      </section>

      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-6xl rounded-panel bg-sage-500 px-6 py-14 md:px-14 md:py-20">
          <FaqAccordion items={faqs} />
          <div className="mt-12 flex justify-center">
            <PillLink href="/contacto" tone="cream">
              Cuéntanos tu caso
            </PillLink>
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
