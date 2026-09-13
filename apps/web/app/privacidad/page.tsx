import type { Metadata } from "next";
import { LegalNotice } from "@/components/LegalNotice";
import { PageHero } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Política de privacidad · LUMIA",
    description:
      "Política de privacidad y tratamiento de datos de LUMIA, clínica de logopedia y terapia miofuncional en Xàtiva.",
    path: "/privacidad",
  }),
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
