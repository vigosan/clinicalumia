import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const neueHaas = localFont({
  src: [
    { path: "./fonts/NeueHaasDisplayLight.ttf", weight: "300" },
    { path: "./fonts/NeueHaasDisplayRoman.ttf", weight: "400" },
    { path: "./fonts/NeueHaasDisplayMedium.ttf", weight: "500" },
    { path: "./fonts/NeueHaasDisplayBold.ttf", weight: "700" },
  ],
  variable: "--font-neue-haas",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://clinicalumia.es";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Lumia · Logopedia miofuncional en Xàtiva",
  description:
    "Clínica de logopedia miofuncional en Xàtiva. Terapia para niños y adultos: deglución atípica, respiración, habla y voz. Pide cita: 614 552 808.",
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
  alternates: {
    canonical: "/",
  },
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
  themeColor: "#6b7d6a",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "MedicalClinic",
  name: "Lumia · Clínica Logopedia miofuncional",
  url: SITE_URL,
  telephone: "+34614552808",
  image: `${SITE_URL}/logo-dark.png`,
  logo: `${SITE_URL}/logo-dark.png`,
  medicalSpecialty: "SpeechPathology",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Xàtiva",
    addressRegion: "Valencia",
    addressCountry: "ES",
  },
  areaServed: {
    "@type": "City",
    name: "Xàtiva",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-ES" className={`${neueHaas.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-cream-100 text-ink-600 font-sans antialiased">
        {children}
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD payload is a static, server-controlled object
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}
