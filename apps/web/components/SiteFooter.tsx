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

const rowClass = "border-cream-50/50 border-b py-5";
const labelClass = "text-body text-cream-50";
const valueClass = "mt-2 text-cream-50/85 text-action";

export function SiteFooter() {
  return (
    <footer className="bg-sage-500 px-6 py-14 md:px-[9.3vw] md:pt-[6vw]">
      <Image
        src="/logo-white.png"
        alt="LUMIA · Clínica Logopedia miofuncional"
        width={1080}
        height={400}
        className="h-auto w-44 md:w-[16vw]"
      />

      <div className="mt-12 max-w-xl md:mt-[4vw]">
        <div className={rowClass}>
          <p className={labelClass}>Dirección</p>
          <p className={valueClass}>
            {isPending(site.address.street)
              ? "Pendiente de confirmar"
              : `${site.address.street}, ${site.address.postalCode} ${site.address.locality}`}
          </p>
        </div>

        <div className={rowClass}>
          <p className={labelClass}>
            {isPending(site.whatsapp.href) ? "Teléfono" : "WhatsApp"}
          </p>
          <a
            href={
              isPending(site.whatsapp.href)
                ? site.phone.href
                : site.whatsapp.href
            }
            className={`${valueClass} block underline-offset-2 hover:underline`}
          >
            {site.phone.display}
          </a>
        </div>

        <div className={rowClass}>
          <p className={labelClass}>Horario</p>
          <p className={valueClass}>
            {isPending(site.schedule[0].days)
              ? "Pendiente de confirmar"
              : `${site.schedule[0].days}: ${site.schedule[0].hours}`}
          </p>
        </div>

        <div className={rowClass}>
          <p className={labelClass}>Servicios profesionales</p>
          <ul className={`${valueClass} flex flex-col gap-1`}>
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
        </div>

        <div className={rowClass}>
          <p className={labelClass}>Bases legales</p>
          <ul className={`${valueClass} flex flex-col gap-1`}>
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
        </div>
      </div>
    </footer>
  );
}
