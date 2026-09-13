import type { Metadata } from "next";
import { LegalNotice } from "@/components/LegalNotice";
import { PageHero } from "@/components/PageHero";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Aviso legal · LUMIA",
    description:
      "Aviso legal de LUMIA, clínica de logopedia y terapia miofuncional en Xàtiva.",
    path: "/aviso-legal",
  }),
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
