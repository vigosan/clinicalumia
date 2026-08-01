import Image from "next/image";
import { FaqAccordion } from "@/components/FaqAccordion";
import { GoogleIcon, Sparkle } from "@/components/icons";
import { PillLink } from "@/components/PillLink";
import { ServiceList } from "@/components/ServiceList";
import { faqs } from "@/lib/faqs";
import { services } from "@/lib/services";
import { isPending, site } from "@/lib/site";

const clinicPhotos = [
  { src: "/clinica-01.jpg", alt: "Recepción de la clínica LUMIA en Xàtiva" },
  { src: "/clinica-02.jpg", alt: "Sala de tratamiento de la clínica LUMIA" },
];

export default function Home() {
  return (
    <>
      <section className="px-3 pt-3 md:px-4 md:pt-4">
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

          <div className="relative z-10 flex min-h-[620px] flex-col justify-end px-6 pt-32 pb-14 md:min-h-[780px] md:px-12 md:pb-20">
            <p className="text-cream-50 md:text-lg">
              Clínica de logopedia y terapia miofuncional en {site.city}
            </p>
            <h1 className="mt-3 max-w-2xl font-bold text-4xl text-cream-50 leading-[1.02] tracking-tight md:text-hero">
              Cuando el cuerpo aprende, todo cambia.
            </h1>
            <div className="mt-8">
              <PillLink href="/contacto" tone="cream">
                Solicita tu primera valoración
              </PillLink>
            </div>
            <Sparkle className="mt-10 size-8 text-cream-50 md:absolute md:right-12 md:bottom-16 md:mt-0 md:size-12" />
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12 md:py-14">
        <p className="mx-auto max-w-6xl rounded-panel bg-sage-500 px-8 py-10 text-center font-bold text-2xl text-cream-50 tracking-tight md:py-14 md:text-section">
          Clínica de logopedia y terapia miofuncional
        </p>
      </section>

      <section className="px-6 pb-10 md:px-12" id="servicios">
        <div className="mx-auto max-w-6xl">
          <ServiceList items={services} />
        </div>
      </section>

      <section className="px-6 py-16 md:px-12 md:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="font-bold text-section text-sage-500 tracking-tight">
            ¿No sabes qué tratamiento necesitas?
          </h2>
          <p className="text-ink-500 text-lg leading-relaxed">
            Especialistas en logopedia infantil, logopedia para adultos y
            terapia miofuncional orofacial en {site.city}. En {site.name}{" "}
            trabajamos funciones esenciales como respirar, masticar, deglutir,
            hablar y utilizar correctamente la musculatura orofacial, desde un
            enfoque clínico, personalizado y basado en evidencia científica.
          </p>
          <p className="text-ink-500 text-lg leading-relaxed">
            Cada paciente es diferente. Realizamos una valoración personalizada
            para identificar el origen del problema y diseñar el tratamiento más
            adecuado.
          </p>
          <PillLink href="/contacto">Solicita tu primera valoración</PillLink>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12 md:py-16" id="somos-lumia">
        <div className="mx-auto grid max-w-6xl items-start gap-10 md:grid-cols-2 md:gap-16">
          <Image
            src="/patricia.jpg"
            alt="Patricia Hernán, logopeda especializada en terapia miofuncional"
            width={1086}
            height={1448}
            className="h-auto w-full rounded-panel object-cover"
          />

          <div className="flex flex-col gap-5">
            <h2 className="font-bold text-section text-ink-600 tracking-tight">
              El faro detrás de LUMIA
            </h2>
            <p className="font-medium text-ink-600 text-lg">
              Cuando el cuerpo aprende, todo cambia.
            </p>
            <p className="text-ink-500 leading-relaxed">
              LUMIA nace de una forma diferente de entender la logopedia. No se
              trata únicamente de corregir un sonido o trabajar una dificultad
              concreta, sino de comprender cómo funciona el cuerpo para
              devolverle el equilibrio.
            </p>
            <p className="text-ink-500 leading-relaxed">
              Al frente del proyecto está Patricia Hernán, logopeda
              especializada en trastornos orofaciales y terapia miofuncional,
              con más de diez años de experiencia clínica dedicados a mejorar
              funciones tan esenciales como la respiración, la deglución, la
              masticación, el habla y el desarrollo del lenguaje.
            </p>
            <p className="font-medium text-ink-600">
              ¿Qué está provocando realmente el problema?
            </p>
            <p className="text-ink-500 leading-relaxed">
              Porque muchas veces el síntoma no es el origen. Una respiración
              oral, una deglución atípica, una alteración en la movilidad
              lingual o un frenillo restrictivo pueden pasar desapercibidos
              durante años y afectar al desarrollo, la salud y la calidad de
              vida sin que nadie relacione unas dificultades con otras.
            </p>
            <div>
              <PillLink href="/sobre-lumia">Somos LUMIA</PillLink>
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12 md:py-16" id="preguntas">
        <div className="mx-auto max-w-6xl rounded-panel bg-sage-500 px-6 py-14 md:px-14 md:py-20">
          <h2 className="text-center font-bold text-section text-cream-50 tracking-tight">
            Preguntas frecuentes
          </h2>
          <div className="mt-10">
            <FaqAccordion items={faqs} />
          </div>
          <div className="mt-12 flex justify-center">
            <PillLink href="/contacto" tone="cream">
              Cuéntanos tu caso
            </PillLink>
          </div>
        </div>
      </section>

      <section className="px-6 py-10 md:px-12 md:py-16" id="clinica">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-bold text-section text-ink-600 tracking-tight">
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
