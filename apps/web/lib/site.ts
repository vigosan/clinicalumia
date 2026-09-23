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
    number: "+34614552808",
    href: "https://wa.me/34614552808",
  },
  email: "info@clinicalumia.es",
  address: {
    street: "Calle Montesa 7",
    postalCode: "46800",
    locality: "Xàtiva",
    region: "Valencia",
    country: "ES",
  },
  maps: "https://www.google.com/maps/search/?api=1&query=Calle%20Montesa%207%2C%2046800%20X%C3%A0tiva%2C%20Valencia",
  instagram: "https://www.instagram.com/clinicalumiaxativa/",
  schedule: [
    { days: "Mañana", hours: "con cita previa" },
    { days: "Tarde", hours: "de 15:15 a 20:30" },
  ],
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
