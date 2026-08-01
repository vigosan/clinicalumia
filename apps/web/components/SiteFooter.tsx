import Image from "next/image";
import Link from "next/link";
import { isPending, site } from "@/lib/site";

const legalLinks = [
  { href: "/aviso-legal", label: "Aviso legal" },
  { href: "/privacidad", label: "Política de privacidad" },
  { href: "/cookies", label: "Política de cookies" },
];

const serviceLinks = [
  { href: "/terapia-miofuncional-xativa", label: "Terapia miofuncional" },
  { href: "/logopedia-infantil-xativa", label: "Logopedia infantil" },
  { href: "/logopedia-adultos-xativa", label: "Logopedia en adultos" },
  { href: "/rehabilitacion-vocal-xativa", label: "Voz y rehabilitación vocal" },
];

function FooterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-cream-50/40 border-b py-4">
      <p className="text-cream-50 text-lg">{label}</p>
      <div className="mt-1 text-cream-50/80 text-sm">{children}</div>
    </div>
  );
}

export function SiteFooter() {
  const address = isPending(site.address.street)
    ? "Dirección pendiente de confirmar"
    : `${site.address.street}, ${site.address.postalCode} ${site.address.locality}`;

  return (
    <footer className="bg-sage-500 px-6 py-14 md:px-12 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Image
          src="/logo-white.png"
          alt="LUMIA · Clínica Logopedia miofuncional"
          width={1080}
          height={400}
          className="h-auto w-44 md:w-56"
        />

        <div className="mt-12 grid gap-x-16 gap-y-10 md:grid-cols-2">
          <div>
            <FooterRow label="Dirección">{address}</FooterRow>
            <FooterRow label="Teléfono">
              <a
                href={site.phone.href}
                className="underline-offset-2 hover:underline"
              >
                {site.phone.display}
              </a>
            </FooterRow>
            <FooterRow label="Horario">
              {isPending(site.schedule[0].days)
                ? "Horario pendiente de confirmar"
                : `${site.schedule[0].days}: ${site.schedule[0].hours}`}
            </FooterRow>
          </div>

          <div>
            <FooterRow label="Servicios profesionales">
              <ul className="flex flex-col gap-1">
                {serviceLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="underline-offset-2 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterRow>
            <FooterRow label="Bases legales">
              <ul className="flex flex-col gap-1">
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="underline-offset-2 hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterRow>
          </div>
        </div>

        <p className="mt-12 text-cream-50/70 text-sm">
          © {new Date().getFullYear()} {site.name} · {site.tagline} en{" "}
          {site.city}
        </p>
      </div>
    </footer>
  );
}
