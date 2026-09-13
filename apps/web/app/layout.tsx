import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { pageMetadata } from "@/lib/metadata";
import { servicePages } from "@/lib/service-pages";
import { isPending, nearbyTowns, site } from "@/lib/site";
import "./globals.css";

const neueHaas = localFont({
  src: [
    { path: "./fonts/NeueHaasDisplayLight.ttf", weight: "300" },
    { path: "./fonts/NeueHaasDisplayRoman.ttf", weight: "400" },
    { path: "./fonts/NeueHaasDisplayMedium.ttf", weight: "500" },
    { path: "./fonts/NeueHaasDisplayBold.ttf", weight: "700" },
    { path: "./fonts/NeueHaasDisplayBlack.ttf", weight: "900" },
  ],
  variable: "--font-neue-haas",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  robots: {
    index: true,
    follow: true,
  },
  ...pageMetadata({
    title: "Logopeda y terapia miofuncional en Xàtiva · LUMIA",
    description:
      "Clínica especializada en logopedia infantil, adultos y terapia miofuncional en Xàtiva. Tratamientos personalizados y enfoque funcional.",
    path: "/",
  }),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#a1a791",
};

const clinicId = `${site.url}/#clinic`;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${site.url}/#website`,
      url: site.url,
      name: site.name,
      inLanguage: "es-ES",
      publisher: { "@id": clinicId },
    },
    {
      "@type": "MedicalClinic",
      "@id": clinicId,
      name: site.name,
      alternateName: `${site.name} · ${site.tagline}`,
      description:
        "Clínica especializada en logopedia infantil, logopedia para adultos y terapia miofuncional orofacial en Xàtiva.",
      url: site.url,
      telephone: site.phone.e164,
      image: `${site.url}/og.jpg`,
      logo: `${site.url}/logo-dark.png`,
      medicalSpecialty: "SpeechPathology",
      address: {
        "@type": "PostalAddress",
        ...(isPending(site.address.street)
          ? {}
          : {
              streetAddress: site.address.street,
              postalCode: site.address.postalCode,
            }),
        addressLocality: site.address.locality,
        addressRegion: site.address.region,
        addressCountry: site.address.country,
      },
      areaServed: [site.city, ...nearbyTowns].map((name) => ({
        "@type": "City",
        name,
      })),
      availableService: servicePages.map((page) => ({
        "@type": "MedicalTherapy",
        name: page.h1.split(" · ")[0],
        url: `${site.url}/${page.slug}`,
      })),
      founder: {
        "@type": "Person",
        name: "Patricia Hernán",
        jobTitle: "Logopeda especializada en terapia miofuncional",
        url: `${site.url}/sobre-lumia`,
        worksFor: { "@id": clinicId },
      },
      ...(isPending(site.instagram) ? {} : { sameAs: [site.instagram] }),
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-ES" className={`${neueHaas.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-cream-100 text-ink-600 font-sans antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload is a static, server-controlled object
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
