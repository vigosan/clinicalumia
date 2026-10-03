import type { Metadata } from "next";
import Image from "next/image";
import { CheckIcon } from "@/components/icons";
import { PageHero } from "@/components/PageHero";
import { PillLink } from "@/components/PillLink";
import { pageMetadata } from "@/lib/metadata";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  ...pageMetadata({
    title:
      "Somos LUMIA · Clínica de logopedia y terapia miofuncional en Xàtiva",
    description:
      "Conoce a Patricia Hernán y la forma de trabajar de LUMIA: valoración funcional completa, tratamiento personalizado y coordinación interdisciplinar en Xàtiva.",
    path: "/sobre-lumia",
  }),
};

const facts = [
  { title: "+10 años", detail: "de experiencia clínica" },
  {
    title: "Docente",
    detail:
      "Masterclass de Terapia Miofuncional · Instituto Raimon Gaja y eCampus University",
  },
  {
    title: "En equipo",
    detail: "con odontología, ortodoncia y pediatría",
  },
];

const specialties = [
  "Terapia miofuncional orofacial",
  "Anquiloglosia y alteraciones del frenillo lingual",
  "Respiración oral",
  "Deglución atípica",
  "Alteraciones de la masticación",
  "Trastornos del habla y la articulación",
  "Desarrollo del lenguaje",
  "Trabajo interdisciplinar con odontología, ortodoncia y pediatría",
];

const container = "mx-auto max-w-[78rem] px-6 md:px-12";
const sectionTitle =
  "font-bold text-[2rem] text-ink-900 leading-[1.08] tracking-tight md:text-[2.75rem]";
const body = "text-ink-800 text-lg leading-relaxed";

export default function SobreLumiaPage() {
  return (
    <>
      <PageHero />

      <section
        className={`${container} grid items-center gap-10 pt-16 md:grid-cols-2 md:gap-16 md:pt-24`}
      >
        <div className="flex flex-col gap-6">
          <p className="font-medium text-sage-800 text-sm uppercase tracking-[0.08em]">
            Somos LUMIA
          </p>
          <h1 className="font-bold text-[2.5rem] text-ink-900 leading-[1.04] tracking-tight md:text-[4.25rem]">
            El faro detrás de LUMIA
          </h1>
          <p className="text-ink-800 text-lg leading-relaxed md:text-xl">
            Cuando el cuerpo aprende, todo cambia. LUMIA nace de una forma
            diferente de entender la logopedia. No se trata únicamente de
            corregir un sonido o trabajar una dificultad concreta, sino de
            comprender cómo funciona el cuerpo para devolverle el equilibrio.
          </p>
        </div>
        <Image
          src="/patricia-retrato.jpg"
          alt="Patricia Hernán, logopeda especializada en terapia miofuncional"
          width={1024}
          height={1536}
          sizes="(min-width: 768px) 45vw, 100vw"
          priority
          className="aspect-4/5 w-full rounded-panel object-cover"
        />
      </section>

      <section className={`${container} pt-16 md:pt-20`}>
        <ul data-testid="about-facts" className="grid gap-8 md:grid-cols-3">
          {facts.map((fact) => (
            <li key={fact.title} className="border-sage-300 border-t pt-5">
              <p className="font-bold text-[2rem] text-ink-900 tracking-tight md:text-[2.75rem]">
                {fact.title}
              </p>
              <p className="mt-1 text-base text-ink-800 leading-relaxed">
                {fact.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        className={`${container} grid gap-6 pt-20 md:grid-cols-[1fr_1.4fr] md:gap-16 md:pt-28`}
      >
        <h2 className={sectionTitle}>Quién es Patricia Hernán</h2>
        <div className="flex flex-col gap-5">
          <p className={body}>
            Al frente del proyecto está Patricia Hernán, logopeda especializada
            en trastornos orofaciales y terapia miofuncional, con más de diez
            años de experiencia clínica dedicados a mejorar funciones tan
            esenciales como la respiración, la deglución, la masticación, el
            habla y el desarrollo del lenguaje.
          </p>
          <p className="font-bold text-ink-900 text-xl leading-snug">
            Para Patricia, cada tratamiento comienza con una pregunta: ¿qué está
            provocando realmente el problema?
          </p>
          <p className={body}>
            Porque muchas veces el síntoma no es el origen. Una respiración
            oral, una deglución atípica, una alteración en la movilidad lingual
            o un frenillo restrictivo pueden pasar desapercibidos durante años y
            afectar al desarrollo, la salud y la calidad de vida sin que nadie
            relacione unas dificultades con otras.
          </p>
          <p className={body}>
            Por eso, en {site.name} cada paciente recibe una valoración
            funcional completa para comprender cómo trabaja su sistema orofacial
            y diseñar un tratamiento totalmente personalizado.
          </p>
        </div>
      </section>

      <section className={`${container} pt-20 md:pt-28`}>
        <div className="grid gap-8 rounded-panel bg-sage-100 px-6 py-12 md:grid-cols-[1fr_1.4fr] md:gap-16 md:px-16 md:py-16">
          <h2 className={sectionTitle}>Una forma de entender la logopedia</h2>
          <div className="flex flex-col gap-5 text-ink-900 text-lg leading-relaxed">
            <p>
              LUMIA significa luz. Y esa luz representa el camino que acompaña a
              cada persona durante su proceso de recuperación.
            </p>
            <p>
              Como un faro que orienta sin imponer el rumbo, LUMIA nace para
              ayudar a niños y adultos a recuperar funciones que deberían
              producirse de forma natural: respirar mejor, masticar
              correctamente, deglutir con normalidad, hablar con claridad y
              desarrollar todo su potencial funcional.
            </p>
            <p>
              Porque cuando el cuerpo aprende a hacer las cosas de la manera
              correcta, deja de compensar. Y es entonces cuando aparece el
              verdadero cambio.
            </p>
          </div>
        </div>
      </section>

      <section
        className={`${container} grid gap-10 pt-20 md:grid-cols-2 md:gap-16 md:pt-28`}
      >
        <div className="flex flex-col gap-5">
          <h2 className={sectionTitle}>Formación y especialización</h2>
          <p className={body}>
            Patricia Hernán ha orientado su carrera hacia la evaluación y
            tratamiento de las alteraciones funcionales del sistema orofacial,
            manteniendo una formación continuada en terapia miofuncional y
            colaborando en el ámbito docente mediante la impartición de
            formación especializada.
          </p>
          <p className={body}>
            Entre su trayectoria destaca la participación como docente en la
            Masterclass de Terapia Miofuncional aplicada en Logopedia,
            organizada por el Instituto Raimon Gaja (IRG) y eCampus University,
            donde comparte su experiencia clínica con otros profesionales del
            sector.
          </p>
        </div>
        <div>
          <h3 className="mb-2 font-bold text-ink-900 text-lg">
            Su práctica clínica se centra especialmente en
          </h3>
          <ul>
            {specialties.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 border-sage-300 border-b py-4 text-ink-900 text-lg"
              >
                <CheckIcon className="mt-1 size-5 shrink-0 text-sage-800" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`${container} pt-20 pb-24 md:pt-28 md:pb-32`}>
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
          <blockquote className="font-bold text-[1.75rem] text-ink-900 leading-tight tracking-tight md:text-4xl">
            «Cada paciente tiene una historia diferente. Nuestra labor es
            encontrar el origen de cada dificultad para que el cuerpo vuelva a
            hacer aquello para lo que fue diseñado.»
          </blockquote>
          <PillLink href="/reservar" tone="solid">
            Pide tu primera valoración
          </PillLink>
        </div>
      </section>
    </>
  );
}
