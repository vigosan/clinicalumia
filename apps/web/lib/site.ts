export const PENDING = "PENDIENTE" as const;

export const site = {
  name: "LUMIA",
  tagline: "Clínica Logopedia miofuncional",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.clinicalumia.es",
  city: "Xàtiva",
  region: "Valencia",
  phone: {
    display: "614 552 808",
    href: "tel:+34614552808",
    e164: "+34614552808",
  },
  whatsapp: {
    number: PENDING,
    href: PENDING,
  },
  email: PENDING,
  address: {
    street: PENDING,
    postalCode: PENDING,
    locality: "Xàtiva",
    region: "Valencia",
    country: "ES",
  },
  maps: PENDING,
  instagram: "https://www.instagram.com/clinicalumiaxativa/",
  schedule: [{ days: PENDING, hours: PENDING }],
} as const;

export const nearbyTowns = [
  "Canals",
  "Genovés",
  "Vallada",
  "La Llosa de Ranes",
  "L'Alcúdia de Crespins",
  "Ontinyent",
  "Alzira",
] as const;

export function isPending(value: string) {
  return value === PENDING;
}
