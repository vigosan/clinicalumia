import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { FloatingContact } from "@/components/FloatingContact";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
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
  title: {
    default: "Logopeda y terapia miofuncional en Xàtiva · LUMIA",
    template: "%s",
  },
  description:
    "Clínica especializada en logopedia infantil, adultos y terapia miofuncional en Xàtiva. Tratamientos personalizados y enfoque funcional.",
  keywords: [
    "logopedia",
    "logopeda",
    "terapia miofuncional",
    "logopedia miofuncional",
    "Xàtiva",
    "Valencia",
    "deglución atípica",
    "terapia del habla",
    "clínica logopedia",
  ],
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "/",
    siteName: "Lumia",
    title: "Lumia · Logopedia miofuncional en Xàtiva",
    description:
      "Clínica de logopedia miofuncional en Xàtiva. Terapia para niños y adultos. Pide cita: 614 552 808.",
    images: [
      {
        url: "/hero-desktop.webp",
        width: 1200,
        height: 630,
        alt: "Lumia · Clínica de logopedia miofuncional",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lumia · Logopedia miofuncional en Xàtiva",
    description:
      "Clínica de logopedia miofuncional en Xàtiva. Pide cita: 614 552 808.",
    images: ["/hero-desktop.webp"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#a1a791",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalClinic",
  name: `${site.name} · Clínica Logopedia miofuncional`,
  url: site.url,
  telephone: site.phone.e164,
  image: `${site.url}/logo-dark.png`,
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
        <FloatingContact />
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload is a static, server-controlled object
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
