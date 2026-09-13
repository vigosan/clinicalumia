import type { Metadata } from "next";
import Image from "next/image";
import { FaqAccordion } from "@/components/FaqAccordion";
import { GoogleIcon, Sparkle, WhatsAppIcon } from "@/components/icons";
import { PhotoCarousel } from "@/components/PhotoCarousel";
import { PillLink } from "@/components/PillLink";
import { ServiceList } from "@/components/ServiceList";
import { faqs } from "@/lib/faqs";
import { services } from "@/lib/services";
import { isPending, site } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const clinicPhotos = [
  { src: "/clinica-01.jpg", alt: "Recepción de la clínica LUMIA en Xàtiva" },
  { src: "/clinica-02.jpg", alt: "Sala de tratamiento de la clínica LUMIA" },
];

const instagramSlots = ["uno", "dos", "tres", "cuatro"];

const helpHref = isPending(site.whatsapp.href)
  ? site.phone.href
  : site.whatsapp.href;

export default function Home() {
  return (
    <>
      <section className="px-3 pt-3 md:px-[1.667vw] md:pt-[1.667vw]">
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

          <div className="relative z-10 flex min-h-[620px] flex-col px-6 pt-32 pb-14 md:min-h-[54.427vw] md:px-[5.8333vw] md:pt-[19.64vw] md:pb-[14vw]">
            <p className="text-cream-50 text-kicker">
              Clínica de logopedia y terapia miofuncional en {site.city}
            </p>
            <h1 className="mt-2 max-w-[13ch] font-bold text-cream-50 text-hero">
              Cuando el cuerpo aprende, todo cambia.
            </h1>
            <div className="mt-9 md:mt-[1.979vw]">
              <PillLink href="/contacto" tone="cream">
                Solicita tu primera valoración
              </PillLink>
            </div>
            <a
              href={helpHref}
              className="mt-8 inline-flex h-10 w-fit items-center gap-3 rounded-full border-2 border-cream-50 bg-sage-500 px-4 text-cream-50 text-sm md:absolute md:right-[9.635vw] md:bottom-[4.583vw] md:mt-0 md:text-[1.094vw]"
            >
              ¿Podemos ayudarte?
              <WhatsAppIcon className="size-6" />
            </a>
            <Sparkle className="mt-10 h-8 w-8 text-cream-50 md:absolute md:right-[3.802vw] md:bottom-[4.005vw] md:mt-0 md:h-[4.365vw] md:w-[4.661vw]" />
          </div>
        </div>
      </section>

      <section className="px-6 pt-10 md:px-[12.448vw] md:pt-[5.156vw]">
        <p className="rounded-panel bg-sage-500 px-8 py-10 text-center font-bold text-cream-50 text-section md:py-[2.37vw]">
          Clínica de logopedia y terapia miofuncional
        </p>
      </section>

      <section
        className="px-6 pt-10 md:px-[12.448vw] md:pt-[4.609vw]"
        id="servicios"
      >
        <ServiceList items={services.slice(0, 3)} />
      </section>

      <section className="px-6 py-16 md:px-[12.448vw] md:pt-[6.76vw] md:pb-[5.99vw]">
        <div className="mx-auto flex flex-col items-center text-center md:max-w-[62vw]">
          <h2 className="font-bold text-sage-500 text-section">
            ¿No sabes qué tratamiento necesitas?
          </h2>
          <p className="mt-6 text-body text-ink-700 md:mt-[2.135vw]">
            Especialistas en logopedia infantil, logopedia para adultos y
            terapia miofuncional orofacial en {site.city}.{" "}
            <span className="font-medium">
              En {site.name} trabajamos funciones esenciales como respirar,
              masticar, deglutir, hablar y utilizar correctamente la musculatura
              orofacial, desde un enfoque clínico, personalizado y basado en
              evidencia científica.
            </span>{" "}
            Cada paciente es diferente.{" "}
            <span className="font-medium">
              Realizamos una valoración personalizada para identificar el origen
              del problema y diseñar el tratamiento más adecuado.
            </span>
          </p>
          <div className="mt-8 md:mt-[2.31vw]">
            <PillLink href="/contacto">Solicita tu primera valoración</PillLink>
          </div>
        </div>
      </section>

      <section className="px-6 md:px-[1.667vw]">
        <Image
          src="/consulta.jpg"
          alt="Paciente sonriendo durante una sesión en la clínica LUMIA"
          width={1672}
          height={941}
          sizes="100vw"
          className="aspect-4/3 w-full rounded-panel object-cover object-[50%_42%] md:aspect-[1856/428]"
        />
      </section>

      <section className="px-6 pt-10 md:px-[12.448vw] md:pt-[4.01vw]">
        <ServiceList items={services.slice(3)} />
      </section>

      <section
        className="px-6 pt-10 md:px-[12.448vw] md:pt-[10.1vw]"
        id="somos-lumia"
      >
        <div className="grid items-start gap-10 md:grid-cols-[36.042vw_1fr] md:gap-[5.208vw]">
          <Image
            src="/patricia.jpg"
            alt="Patricia Hernán, logopeda especializada en terapia miofuncional"
            width={1086}
            height={1448}
            sizes="(min-width: 768px) 36vw, 100vw"
            className="aspect-[692/906] w-full rounded-panel object-cover"
          />

          <div className="flex flex-col">
            <h2 className="font-bold text-ink-600 text-section">
              El faro detrás de LUMIA
            </h2>
            <p className="mt-6 font-medium text-body text-ink-600 md:mt-[0.885vw]">
              Cuando el cuerpo aprende, todo cambia.
            </p>
            <p className="mt-6 text-body text-ink-500 md:mt-[2.031vw]">
              LUMIA nace de una forma diferente de entender la logopedia. No se
              trata únicamente de corregir un sonido o trabajar una dificultad
              concreta, sino de comprender cómo funciona el cuerpo para
              devolverle el equilibrio.
            </p>
            <p className="mt-8 text-body text-ink-500 md:mt-[1.823vw]">
              Al frente del proyecto está Patricia Hernán, logopeda
              especializada en trastornos orofaciales y terapia miofuncional,
              con más de diez años de experiencia clínica dedicados a mejorar
              funciones tan esenciales como la respiración, la deglución, la
              masticación, el habla y el desarrollo del lenguaje.
            </p>
            <p className="mt-8 font-medium text-body text-ink-600 md:mt-[2.031vw]">
              ¿Qué está provocando realmente el problema?
            </p>
            <p className="mt-8 text-body text-ink-500 md:mt-[2.031vw]">
              Porque muchas veces el síntoma no es el origen. Una respiración
              oral, una deglución atípica, una alteración en la movilidad
              lingual o un frenillo restrictivo pueden pasar desapercibidos
              durante años y afectar al desarrollo, la salud y la calidad de
              vida sin que nadie relacione unas dificultades con otras.
            </p>
            <div className="mt-9 md:mt-[2.31vw]">
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

      <section className="py-10 md:py-[4vw]" id="clinica">
        <div>
          <h2 className="px-6 text-center font-bold text-ink-600 text-section md:px-[12.448vw]">
            Nuestra clínica
          </h2>

          <div className="mt-10 pl-6 md:mt-[2.4vw] md:pl-[1.667vw]">
            <PhotoCarousel items={clinicPhotos} />
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

      <section className="px-6 py-10 md:px-[3.49vw] md:py-[4vw]" id="instagram">
        <h2 className="text-center font-bold text-ink-600 text-section">
          Síguenos en instagram
        </h2>

        <ul className="mt-10 grid grid-cols-2 gap-4 md:mt-[4.115vw] md:grid-cols-4 md:gap-[1.979vw]">
          {instagramSlots.map((slot) => (
            <li
              key={slot}
              className="aspect-[418/381] rounded-panel bg-cream-200"
            />
          ))}
        </ul>
      </section>
    </>
  );
}
