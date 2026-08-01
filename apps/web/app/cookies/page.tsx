import type { Metadata } from "next";
import { LegalNotice } from "@/components/LegalNotice";
import { PageHero } from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Política de cookies · LUMIA",
  description:
    "Política de cookies de LUMIA, clínica de logopedia y terapia miofuncional en Xàtiva.",
  alternates: { canonical: "/cookies" },
  robots: { index: false, follow: true },
};

export default function CookiesPage() {
  return (
    <>
      <PageHero title="Política de cookies" />
      <LegalNotice document="la política de cookies" />
    </>
  );
}
