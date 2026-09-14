import type { Metadata } from "next";
import Image from "next/image";
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

export default function SobreLumiaPage() {
  return (
    <>
      <PageHero />

      <section className="px-6 pt-12 md:px-12 md:pt-16">
        <div className="mx-auto max-w-6xl">
          <h1 className="font-bold text-ink-600 text-section">
            El faro detrás de LUMIA
          </h1>
          <p className="mt-6 max-w-[46ch] text-ink-500 text-lg leading-relaxed">
            Cuando el cuerpo aprende, todo cambia. LUMIA nace de una forma
            diferente de entender la logopedia. No se trata únicamente de
            corregir un sonido o trabajar una dificultad concreta, sino de
            comprender cómo funciona el cuerpo para devolverle el equilibrio.
          </p>
        </div>
      </section>

      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto grid max-w-6xl items-start gap-10 md:grid-cols-2 md:gap-16">
          <Image
            src="/patricia.jpg"
            alt="Patricia Hernán, logopeda especializada en terapia miofuncional"
            width={1086}
            height={1448}
            sizes="(min-width: 768px) 50vw, 100vw"
            className="h-auto w-full rounded-panel object-cover"
          />

          <div className="flex flex-col gap-5">
            <h2 className="font-bold text-card text-ink-600 tracking-tight md:text-section">
              Quién es Patricia Hernán
            </h2>
            <p className="text-ink-500 leading-relaxed">
              Al frente del proyecto está Patricia Hernán, logopeda
              especializada en trastornos orofaciales y terapia miofuncional,
              con más de diez años de experiencia clínica dedicados a mejorar
              funciones tan esenciales como la respiración, la deglución, la
              masticación, el habla y el desarrollo del lenguaje.
            </p>
            <p className="font-medium text-ink-600">
              Para Patricia, cada tratamiento comienza con una pregunta: ¿qué
              está provocando realmente el problema?
            </p>
            <p className="text-ink-500 leading-relaxed">
              Porque muchas veces el síntoma no es el origen. Una respiración
              oral, una deglución atípica, una alteración en la movilidad
              lingual o un frenillo restrictivo pueden pasar desapercibidos
              durante años y afectar al desarrollo, la salud y la calidad de
              vida sin que nadie relacione unas dificultades con otras.
            </p>
            <p className="text-ink-500 leading-relaxed">
              Por eso, en {site.name} cada paciente recibe una valoración
              funcional completa para comprender cómo trabaja su sistema
              orofacial y diseñar un tratamiento totalmente personalizado.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-14 md:px-12 md:pb-20">
        <div className="mx-auto max-w-6xl rounded-panel bg-sage-500 px-6 py-14 md:px-14 md:py-20">
          <h2 className="font-bold text-card text-cream-50 tracking-tight md:text-section">
            Una forma de entender la logopedia
          </h2>
          <div className="mt-6 flex max-w-3xl flex-col gap-5 text-cream-50/90 leading-relaxed">
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

      <section className="px-6 pb-14 md:px-12 md:pb-20">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-bold text-card text-ink-600 tracking-tight md:text-section">
            Formación y especialización
          </h2>
          <p className="mt-5 text-ink-500 leading-relaxed">
            Patricia Hernán ha orientado su carrera hacia la evaluación y
            tratamiento de las alteraciones funcionales del sistema orofacial,
            manteniendo una formación continuada en terapia miofuncional y
            colaborando en el ámbito docente mediante la impartición de
            formación especializada.
          </p>
          <p className="mt-4 text-ink-500 leading-relaxed">
            Entre su trayectoria destaca la participación como docente en la
            Masterclass de Terapia Miofuncional aplicada en Logopedia,
            organizada por el Instituto Raimon Gaja (IRG) y eCampus University,
            donde comparte su experiencia clínica con otros profesionales del
            sector.
          </p>

          <h3 className="mt-10 font-bold text-ink-600 text-xl">
            Su práctica clínica se centra especialmente en
          </h3>
          <ul className="mt-5 grid gap-x-10 gap-y-3 md:grid-cols-2">
            {specialties.map((item) => (
              <li
                key={item}
                className="border-sage-400/50 border-b pb-3 text-ink-500"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="px-6 pb-20 md:px-12 md:pb-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <blockquote className="font-bold text-card text-ink-600 tracking-tight md:text-section">
            «Cada paciente tiene una historia diferente. Nuestra labor es
            encontrar el origen de cada dificultad para que el cuerpo vuelva a
            hacer aquello para lo que fue diseñado.»
          </blockquote>
          <PillLink href="/contacto">Solicita tu primera valoración</PillLink>
        </div>
      </section>
    </>
  );
}
