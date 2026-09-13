import type { Metadata } from "next";
import { PageHero } from "@/components/PageHero";
import { PillLink } from "@/components/PillLink";

export const metadata: Metadata = {
  title: "Página no encontrada · LUMIA",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <PageHero
      title="Página no encontrada"
      intro="La página que buscas no existe o ha cambiado de dirección. Puedes volver al inicio o consultar nuestros tratamientos de logopedia y terapia miofuncional en Xàtiva."
    >
      <div className="flex flex-wrap gap-4">
        <PillLink href="/" tone="cream">
          Volver al inicio
        </PillLink>
        <PillLink href="/servicios" tone="cream">
          Ver servicios
        </PillLink>
      </div>
    </PageHero>
  );
}
