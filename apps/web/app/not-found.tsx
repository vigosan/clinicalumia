import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { PillLink } from "@/components/PillLink";

export const metadata: Metadata = {
  title: "Página no encontrada · LUMIA",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <PageHero />

      <section className="px-6 pt-12 pb-20 md:px-12 md:pt-16 md:pb-28">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-bold text-ink-600 text-section">
            Página no encontrada
          </h1>
          <p className="mt-6 max-w-[46ch] text-ink-500 text-lg leading-relaxed">
            La página que buscas no existe o ha cambiado de dirección. Puedes
            volver al inicio o consultar nuestros tratamientos de logopedia y
            terapia miofuncional en Xàtiva.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <PillLink href="/">Volver al inicio</PillLink>
            <PillLink href="/servicios">Ver servicios</PillLink>
          </div>
        </div>
      </section>
    </>
  );
}
