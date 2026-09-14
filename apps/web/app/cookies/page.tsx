import type { Metadata } from "next";
import { LegalNotice } from "@/components/LegalNotice";
import { PageHero } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Política de cookies · LUMIA",
    description:
      "Política de cookies de LUMIA, clínica de logopedia y terapia miofuncional en Xàtiva.",
    path: "/cookies",
  }),
  robots: { index: false, follow: true },
};

export default function CookiesPage() {
  return (
    <>
      <PageHero />

      <section className="px-6 pt-12 md:px-12 md:pt-16">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-bold text-ink-600 text-section">
            Política de cookies
          </h1>
        </div>
      </section>
      <LegalNotice document="la política de cookies" />
    </>
  );
}
