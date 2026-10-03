import type { Metadata } from "next";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  ClockIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { PageHero } from "@/components/PageHero";
import { pillClassName } from "@/components/PillLink";
import { pageMetadata } from "@/lib/metadata";
import { isPending, nearbyTowns, site } from "@/lib/site";
import { ContactForm } from "./ContactForm";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Contacto · Clínica LUMIA en Xàtiva",
    description:
      "Pide tu primera valoración en LUMIA. Contacta por teléfono, WhatsApp o formulario con nuestra clínica de logopedia y terapia miofuncional en Xàtiva.",
    path: "/contacto",
  }),
};

function QuickAction({
  href,
  icon,
  title,
  detail,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 rounded-[1.75rem] bg-white p-6 transition-shadow hover:shadow-[0_12px_32px_rgb(58_58_58/0.08)] md:p-7"
    >
      <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-sage-100 text-sage-900">
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="break-words font-bold text-ink-900 text-xl">
          {title}
        </span>
        <span className="text-ink-800 text-sm">{detail}</span>
      </span>
    </a>
  );
}

export default function ContactoPage() {
  const afternoon = site.schedule.find((slot) => slot.days === "Tarde");

  return (
    <>
      <PageHero />

      <section className="px-6 pt-16 md:px-12 md:pt-24">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-bold text-[2.5rem] text-ink-900 leading-[1.04] tracking-tight md:text-[4.25rem]">
            Estamos aquí para ayudarte
          </h1>
          <p className="mt-6 max-w-2xl text-ink-800 text-lg leading-relaxed md:text-xl">
            Llámanos, escríbenos o cuéntanos tu caso. Te orientamos sobre el
            primer paso más adecuado.
          </p>
        </div>
      </section>

      <section className="px-6 pt-12 md:px-12 md:pt-16">
        <div
          data-testid="contact-quick"
          className="mx-auto grid max-w-6xl gap-4 md:grid-cols-3 md:gap-5"
        >
          <QuickAction
            href={site.phone.href}
            icon={<PhoneIcon className="size-6" />}
            title={site.phone.display}
            detail={
              afternoon ? `Llámanos · tarde ${afternoon.hours}` : "Llámanos"
            }
          />
          {!isPending(site.whatsapp.href) && (
            <QuickAction
              href={site.whatsapp.href}
              icon={<WhatsAppIcon className="size-6" />}
              title="WhatsApp"
              detail="Escríbenos cuando te venga bien"
            />
          )}
          <QuickAction
            href={`mailto:${site.email}`}
            icon={<MailIcon className="size-6" />}
            title={site.email}
            detail="Para dudas o documentación"
          />
        </div>
      </section>

      <section className="px-6 pt-12 pb-24 md:px-12 md:pt-16 md:pb-32">
        <div className="mx-auto grid max-w-6xl items-start gap-8 md:grid-cols-[1.6fr_1fr]">
          <div className="rounded-[2rem] bg-white p-6 md:p-12">
            <h2 className="font-bold text-[2rem] text-ink-900 tracking-tight md:text-4xl">
              Cuéntanos tu caso
            </h2>
            <p className="mt-2 mb-8 text-ink-800 text-lg">
              Cuéntanos brevemente qué necesitas y te contactaremos para
              orientarte.
            </p>
            <ContactForm />
          </div>

          <aside className="flex flex-col gap-5">
            <Image
              src="/patricia-recepcion.jpg"
              alt="Recepción de la clínica LUMIA en Xàtiva"
              width={1024}
              height={1536}
              sizes="(min-width: 768px) 33vw, 100vw"
              className="h-72 w-full rounded-[2rem] object-cover object-[25%_40%]"
            />
            <div className="flex flex-col gap-6 rounded-[2rem] bg-white p-8">
              <div className="flex gap-3">
                <MapPinIcon className="mt-0.5 size-6 shrink-0 text-sage-800" />
                <p className="text-ink-800">
                  <span className="block font-bold text-ink-900">
                    {site.address.street}
                  </span>
                  {site.address.postalCode} {site.address.locality},{" "}
                  {site.address.region}
                </p>
              </div>
              <div className="flex gap-3">
                <ClockIcon className="mt-0.5 size-6 shrink-0 text-sage-800" />
                <ul className="text-ink-800">
                  {site.schedule.map((slot) => (
                    <li key={slot.days}>
                      {slot.days}: {slot.hours}
                    </li>
                  ))}
                </ul>
              </div>
              {!isPending(site.maps) && (
                <a
                  href={site.maps}
                  target="_blank"
                  rel="noreferrer"
                  className={pillClassName("sage")}
                >
                  Cómo llegar
                </a>
              )}
              <p className="text-ink-800 text-sm leading-relaxed">
                Atendemos pacientes de {site.city} y localidades cercanas como{" "}
                {nearbyTowns.join(", ")} y otros municipios de La Costera.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
