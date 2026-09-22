import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { consentTitle } from "@/lib/consent-legal";
import { ConsentForm } from "./ConsentForm";

export const metadata: Metadata = {
  title: `${consentTitle} · LUMIA`,
  robots: { index: false, follow: false },
};

export default function ConsentimientoPage() {
  return (
    <>
      <PageHero />

      <section className="px-6 py-12 md:px-12 md:py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-bold text-ink-600 text-section">
            {consentTitle}
          </h1>
          <p className="mt-4 mb-10 text-ink-500 text-lg leading-relaxed">
            Rellena tus datos, lee la información sobre protección de datos y
            firma al final.
          </p>
          <ConsentForm />
        </div>
      </section>
    </>
  );
}
