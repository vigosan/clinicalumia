import type { Metadata } from "next";
import { LegalNotice } from "@/components/LegalNotice";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Aviso legal · LUMIA",
  description:
    "Aviso legal de LUMIA, clínica de logopedia y terapia miofuncional en Xàtiva.",
  alternates: { canonical: "/aviso-legal" },
  robots: { index: false, follow: true },
};

export default function AvisoLegalPage() {
  return (
    <>
      <PageHero title="Aviso legal" />
      <LegalNotice document="el aviso legal" />
    </>
  );
}
