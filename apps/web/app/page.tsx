import type { Metadata } from "next";
import Image from "next/image";
import { FaqAccordion } from "@/components/FaqAccordion";
import { GoogleIcon, Sparkle } from "@/components/icons";
import { PillLink } from "@/components/PillLink";
import { ServiceList } from "@/components/ServiceList";
import { faqs } from "@/lib/faqs";
import { services } from "@/lib/services";
import { isPending, site } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const clinicPhotos = [
  { src: "/clinica-02.jpg", alt: "Sala de tratamiento de la clínica LUMIA" },
  { src: "/patricia.jpg", alt: "Patricia Hernán en la consulta de LUMIA" },
];

export default function Home() {
  return (
    <>
      <section className="px-3 md:px-[1.667vw]">
        <div className="relative overflow-hidden rounded-panel bg-sage-500">
          <Image
            src="/hero-mobile.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 0px, 100vw"
            className="object-cover object-center md:hidden"
          />
          <Image
            src="/hero-desktop.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 768px) 100vw, 0px"
            className="hidden object-cover object-center md:block"
          />

          <div className="relative z-10 flex min-h-[620px] flex-col px-6 pt-32 pb-14 md:min-h-[51.4vw] md:px-[4.167vw] md:pt-[19.8vw] md:pb-[14vw]">
            <p className="text-cream-50 text-kicker">
              Clínica de logopedia y terapia miofuncional en {site.city}
            </p>
            <h1 className="mt-2 max-w-[13ch] font-bold text-cream-50 text-hero">
              Cuando el cuerpo aprende, todo cambia.
            </h1>
            <div className="mt-9">
              <PillLink href="/contacto" tone="cream">
                Solicita tu primera valoración
              </PillLink>
            </div>
            <Sparkle className="mt-10 size-8 text-cream-50 md:absolute md:right-[4.5vw] md:bottom-[5vw] md:mt-0 md:size-[3.4vw]" />
          </div>
        </div>
      </section>

      <section className="px-6 pt-10 md:px-[12.448vw] md:pt-[2.2vw]">
        <p className="rounded-panel bg-sage-500 px-8 py-10 text-center font-bold text-cream-50 text-section md:py-[5vw]">
          Clínica de logopedia y terapia miofuncional
        </p>
      </section>

      <section
        className="px-6 pt-10 md:px-[13.02vw] md:pt-[2.3vw]"
        id="servicios"
      >
        <ServiceList items={services.slice(0, 3)} />
      </section>

      <section className="px-6 py-16 md:px-[13.02vw] md:py-[7vw]">
        <div className="mx-auto flex max-w-[64rem] flex-col items-center gap-5 text-center">
          <h2 className="font-bold text-sage-500 text-section">
            ¿No sabes qué tratamiento necesitas?
          </h2>
          <p className="text-body text-ink-500">
            Especialistas en logopedia infantil, logopedia para adultos y
            terapia miofuncional orofacial en {site.city}.{" "}
            <span className="font-medium text-ink-600">
              En {site.name} trabajamos funciones esenciales como respirar,
              masticar, deglutir, hablar y utilizar correctamente la musculatura
              orofacial, desde un enfoque clínico, personalizado y basado en
              evidencia científica.
            </span>
          </p>
          <p className="text-body text-ink-500">
            Cada paciente es diferente.{" "}
            <span className="font-medium text-ink-600">
              Realizamos una valoración personalizada para identificar el origen
              del problema y diseñar el tratamiento más adecuado.
            </span>
          </p>
          <div className="mt-4">
            <PillLink href="/contacto">Solicita tu primera valoración</PillLink>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-[1.667vw]">
        <Image
          src="/clinica-01.jpg"
          alt="Recepción de la clínica LUMIA en Xàtiva"
          width={1448}
          height={1086}
          sizes="100vw"
          className="aspect-[1792/620] w-full rounded-panel object-cover object-top"
        />
      </section>

      <section className="px-6 pt-10 md:px-[13.02vw] md:pt-[6vw]">
        <ServiceList items={services.slice(3)} />
      </section>

      <section
        className="px-6 py-10 md:px-[13.02vw] md:py-[4vw]"
        id="somos-lumia"
      >
        <div className="grid items-start gap-10 md:grid-cols-[45fr_55fr] md:gap-[5.2vw]">
          <Image
            src="/patricia.jpg"
            alt="Patricia Hernán, logopeda especializada en terapia miofuncional"
            width={1086}
            height={1448}
            className="h-auto w-full rounded-panel object-cover"
          />

          <div className="flex flex-col">
            <h2 className="font-bold text-ink-600 text-section">
              El faro detrás de LUMIA
            </h2>
            <p className="mt-6 font-medium text-body text-ink-600">
              Cuando el cuerpo aprende, todo cambia.
            </p>
            <p className="mt-6 text-body text-ink-500">
              LUMIA nace de una forma diferente de entender la logopedia. No se
              trata únicamente de corregir un sonido o trabajar una dificultad
              concreta, sino de comprender cómo funciona el cuerpo para
              devolverle el equilibrio.
            </p>
            <p className="mt-8 text-body text-ink-500">
              Al frente del proyecto está Patricia Hernán, logopeda
              especializada en trastornos orofaciales y terapia miofuncional,
              con más de diez años de experiencia clínica dedicados a mejorar
              funciones tan esenciales como la respiración, la deglución, la
              masticación, el habla y el desarrollo del lenguaje.
            </p>
            <p className="mt-8 font-medium text-body text-ink-600">
              ¿Qué está provocando realmente el problema?
            </p>
            <p className="mt-8 text-body text-ink-500">
              Porque muchas veces el síntoma no es el origen. Una respiración
              oral, una deglución atípica, una alteración en la movilidad
              lingual o un frenillo restrictivo pueden pasar desapercibidos
              durante años y afectar al desarrollo, la salud y la calidad de
              vida sin que nadie relacione unas dificultades con otras.
            </p>
            <div className="mt-9">
              <PillLink href="/sobre-lumia">Somos LUMIA</PillLink>
            </div>
          </div>
        </div>
      </section>

      <section
        className="px-6 py-10 md:px-[12.448vw] md:py-[4vw]"
        id="preguntas"
      >
        <div className="rounded-panel bg-sage-500 px-6 py-14 md:px-[5.8vw] md:py-[5vw]">
          <h2 className="text-center font-bold text-cream-50 text-section">
            Preguntas frecuentes | FyQ
          </h2>
          <div className="mt-12">
            <FaqAccordion items={faqs} />
          </div>
          <div className="mt-14 flex justify-center">
            <PillLink href="/contacto" tone="cream">
              Cuéntanos tu caso
            </PillLink>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-[13.02vw] md:py-[4vw]" id="clinica">
        <div>
          <h2 className="text-center font-bold text-ink-600 text-section">
            Nuestra clínica
          </h2>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {clinicPhotos.map((photo) => (
              <Image
                key={photo.src}
                src={photo.src}
                alt={photo.alt}
                width={1400}
                height={1050}
                sizes="(min-width: 768px) 50vw, 100vw"
                className="aspect-4/3 w-full rounded-panel object-cover"
              />
            ))}
          </div>

          {!isPending(site.maps) && (
            <div className="mt-8 flex justify-center">
              <a
                href={site.maps}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-medium text-sage-600 transition-opacity hover:opacity-70"
              >
                Ver en el mapa cómo llegar con Google Maps
                <GoogleIcon className="size-5" />
              </a>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
