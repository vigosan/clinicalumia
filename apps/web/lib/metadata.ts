import type { Metadata } from "next";
import { site } from "./site";

const ogImage = {
  url: "/og.jpg",
  width: 1200,
  height: 630,
  alt: `${site.name} · ${site.tagline} en ${site.city}`,
};

export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "es_ES",
      siteName: site.name,
      url: path,
      title,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
    },
  };
}
