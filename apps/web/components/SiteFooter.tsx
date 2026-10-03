import Image from "next/image";
import Link from "next/link";
import { isPending, site } from "@/lib/site";

const linkClassName =
  "underline decoration-1 underline-offset-4 transition-opacity hover:opacity-70";

export function SiteFooter() {
  const { address } = site;

  return (
    <footer className="bg-sage-500 px-6 pt-14 pb-10 text-ink-900 md:px-12 md:pt-20">
      <div className="mx-auto flex max-w-6xl flex-col gap-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <Image
            src="/logo-white.png"
            alt="LUMIA · Clínica Logopedia miofuncional"
            width={1080}
            height={400}
            className="h-auto w-44 md:w-52"
          />

          <div className="flex flex-col gap-2">
            <h2 className="font-bold">Dirección</h2>
            <p>
              {address.street}
              <br />
              {address.postalCode} {address.locality}, {address.region}
            </p>
            {!isPending(site.maps) && (
              <a
                href={site.maps}
                target="_blank"
                rel="noreferrer"
                className={linkClassName}
              >
                Cómo llegar
              </a>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="font-bold">Horario</h2>
            <ul>
              {site.schedule.map((slot) => (
                <li key={slot.days}>
                  {slot.days}: {slot.hours}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col items-start gap-2">
            <h2 className="font-bold">Contacto</h2>
            <a href={site.phone.href} className={linkClassName}>
              {site.phone.display}
            </a>
            {!isPending(site.whatsapp.href) && (
              <a href={site.whatsapp.href} className={linkClassName}>
                WhatsApp
              </a>
            )}
            <a href={`mailto:${site.email}`} className={linkClassName}>
              {site.email}
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-ink-900 border-t pt-6 text-sm md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name} · {site.tagline}
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href="/privacidad" className={linkClassName}>
                Política de privacidad
              </Link>
            </li>
            <li>
              <Link href="/servicios" className={linkClassName}>
                Servicios
              </Link>
            </li>
            <li>
              <Link href="/mi-cuenta" className={linkClassName}>
                Mi cuenta
              </Link>
            </li>
            {!isPending(site.instagram) && (
              <li>
                <a href={site.instagram} className={linkClassName}>
                  Instagram
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>
    </footer>
  );
}
