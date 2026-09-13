import type { MetadataRoute } from "next";
import { servicePages } from "@/lib/service-pages";
import { site } from "@/lib/site";

const staticPaths = [
  "/sobre-lumia",
  "/servicios",
  "/preguntas-frecuentes",
  "/contacto",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: site.url,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...servicePages.map((page) => ({
      url: `${site.url}/${page.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    })),
    ...staticPaths.map((path) => ({
      url: `${site.url}${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
