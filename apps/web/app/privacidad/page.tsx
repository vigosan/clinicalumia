import type { Metadata } from "next";
import { LegalNotice } from "@/components/LegalNotice";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Política de privacidad · LUMIA",
  description:
    "Política de privacidad y tratamiento de datos de LUMIA, clínica de logopedia y terapia miofuncional en Xàtiva.",
  alternates: { canonical: "/privacidad" },
  robots: { index: false, follow: true },
};

export default function PrivacidadPage() {
  return (
    <>
      <PageHero title="Política de privacidad" />
      <LegalNotice document="la política de privacidad" />
    </>
  );
}
