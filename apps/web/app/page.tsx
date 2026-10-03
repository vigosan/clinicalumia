import Image, { getImageProps } from "next/image";
import Link from "next/link";
import { CtaBand } from "@/components/CtaBand";
import { FaqAccordion } from "@/components/FaqAccordion";
import {
  ArrowRightIcon,
  ClockIcon,
  MapPinIcon,
  PhoneIcon,
} from "@/components/icons";
import { PillLink, pillClassName } from "@/components/PillLink";
import { ServiceList } from "@/components/ServiceList";
import { faqs } from "@/lib/faqs";
import { getLatestInstagramPosts } from "@/lib/instagram";
import { services } from "@/lib/services";
import { isPending, nearbyTowns, site } from "@/lib/site";

const facts = [
  {
    title: "+10 años",
    detail:
      "de experiencia clínica en trastornos orofaciales y terapia miofuncional.",
  },
  {
    title: "Niños y adultos",
    detail: "Del desarrollo del lenguaje a la rehabilitación tras un ictus.",
  },
  {
    title: "Docente IRG",
    detail: "Masterclass de Terapia Miofuncional aplicada en Logopedia.",
  },
];

const steps = [
  {
    title: "Nos cuentas tu caso",
    detail:
      "Por teléfono, WhatsApp o con el formulario. Te orientamos sobre el primer paso.",
  },
  {
    title: "Valoración funcional completa",
    detail:
      "Estudiamos cómo trabaja tu sistema orofacial para encontrar el origen del problema.",
  },
  {
    title: "Tratamiento a tu medida",
    detail:
      "Diseñamos un plan personalizado y lo coordinamos con otros profesionales si hace falta.",
  },
];

const heroBreakpoint = "(min-width: 768px)";

const heroDesktop = getImageProps({
  src: "/hero-desktop.webp",
  alt: "",
  fill: true,
  priority: true,
  sizes: "100vw",
});

const heroMobile = getImageProps({
  src: "/hero-mobile.webp",
  alt: "",
  fill: true,
  priority: true,
  sizes: "100vw",
});

const container = "mx-auto max-w-[78rem] px-6 md:px-12";
const eyebrow = "font-medium text-sage-800 text-sm uppercase tracking-[0.08em]";
const sectionTitle =
  "font-bold text-[2rem] text-ink-900 leading-[1.08] tracking-tight md:text-[3.25rem]";

export default async function Home() {
  const instagramPosts = await getLatestInstagramPosts(4);
  const featuredFaqs = faqs.filter((faq) => faq.featured);

  return (
    <>
      <section className="md:px-6">
        <div
          data-testid="home-hero"
          data-over-photo
          className="relative overflow-hidden rounded-b-panel bg-sage-500"
        >
          <link
            rel="preload"
            as="image"
            imageSrcSet={heroDesktop.props.srcSet}
            imageSizes="100vw"
            media={heroBreakpoint}
            fetchPriority="high"
          />
          <link
            rel="preload"
            as="image"
            imageSrcSet={heroMobile.props.srcSet}
            imageSizes="100vw"
            media="(max-width: 767px)"
            fetchPriority="high"
          />
          <picture>
            <source
              media={heroBreakpoint}
              srcSet={heroDesktop.props.srcSet}
              sizes="100vw"
            />
            <img
              {...heroMobile.props}
              alt=""
              fetchPriority="high"
              className="object-cover object-center md:scale-110"
            />
          </picture>
          <div className="absolute inset-0 bg-linear-to-b from-[rgb(38_40_32/0.65)] via-[rgb(38_40_32/0.45)] via-60% to-[rgb(38_40_32/0.2)] md:bg-linear-to-r md:from-[rgb(38_40_32/0.62)] md:via-[rgb(38_40_32/0.3)] md:to-transparent" />

          <div className="relative z-10 flex min-h-[640px] flex-col px-6 pt-32 pb-14 md:min-h-[46rem] md:justify-end md:px-14 md:pb-20">
            <div className="flex max-w-2xl flex-col gap-5">
              <h1 className="font-medium text-cream-50 text-sm uppercase tracking-[0.08em]">
                Logopedia y terapia miofuncional · {site.city}
              </h1>
              <p className="font-bold text-[2.75rem] text-white leading-[1.02] tracking-tight md:text-[4.75rem]">
                Cuando el cuerpo aprende, todo cambia.
              </p>
              <p className="max-w-lg text-cream-50 text-lg leading-relaxed md:text-xl">
                Valoramos cómo respiras, tragas, masticas y hablas para tratar
                el origen del problema, no solo el síntoma.
              </p>
              <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                <PillLink href="/reservar" tone="light">
                  Pide tu primera valoración
                </PillLink>
                <a
                  href={site.phone.href}
                  className={pillClassName(
                    "cream",
                    "bg-[rgb(38_40_32/0.45)] backdrop-blur-sm md:bg-transparent md:backdrop-blur-none",
                  )}
                >
                  <PhoneIcon className="size-5" />
                  Llamar · {site.phone.display}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={`${container} pt-16 md:pt-20`}>
        <ul className="grid gap-8 md:grid-cols-3">
          {facts.map((fact) => (
            <li key={fact.title} className="border-sage-300 border-t pt-5">
              <p className="font-bold text-[2rem] text-ink-900 tracking-tight md:text-[2.5rem]">
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
        id="servicios"
        aria-labelledby="servicios-titulo"
        className={`${container} pt-20 md:pt-28`}
      >
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <h2 id="servicios-titulo" className={sectionTitle}>
            ¿En qué podemos ayudarte?
          </h2>
          <Link
            href="/servicios"
            className="inline-flex items-center gap-2 font-medium text-lg text-sage-800 hover:text-sage-900"
          >
            Ver todos los tratamientos
            <ArrowRightIcon className="size-5" />
          </Link>
        </div>
        <ServiceList items={services} />
      </section>

      <section className={`${container} pt-20 md:pt-28`}>
        <div className="flex flex-col gap-10 rounded-panel bg-sage-100 px-6 py-12 md:px-16 md:py-16">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex max-w-2xl flex-col gap-4">
              <p className={eyebrow}>Primera valoración</p>
              <h2 className="font-bold text-[1.75rem] text-ink-900 leading-[1.1] tracking-tight md:text-[2.75rem]">
                ¿No sabes qué tratamiento necesitas? Empezamos por entenderlo.
              </h2>
            </div>
            <PillLink href="/reservar" tone="solid">
              Pide tu primera valoración
            </PillLink>
          </div>
          <ol className="grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="flex flex-col gap-3 rounded-[1.75rem] bg-cream-50 p-8"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-sage-800 font-bold text-cream-50">
                  {index + 1}
                </span>
                <h3 className="font-bold text-ink-900 text-xl">{step.title}</h3>
                <p className="text-base text-ink-800 leading-relaxed">
                  {step.detail}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="somos-lumia"
        className={`${container} grid items-center gap-10 pt-20 md:grid-cols-2 md:gap-16 md:pt-28`}
      >
        <Image
          src="/patricia-retrato.jpg"
          alt="Patricia Hernán, logopeda especializada en terapia miofuncional"
          width={1024}
          height={1536}
          sizes="(min-width: 768px) 40vw, 100vw"
          className="aspect-4/5 w-full rounded-panel object-cover"
        />
        <div className="flex flex-col gap-5">
          <p className={eyebrow}>El faro detrás de LUMIA</p>
          <h2 className={sectionTitle}>Patricia Hernán</h2>
          <p className="text-ink-800 text-lg leading-relaxed">
            Logopeda especializada en trastornos orofaciales y terapia
            miofuncional, con más de diez años de experiencia clínica.
          </p>
          <blockquote className="font-bold text-2xl text-ink-900 leading-snug tracking-tight md:text-[1.75rem]">
            «Cada tratamiento comienza con una pregunta: ¿qué está provocando
            realmente el problema?»
          </blockquote>
          <div>
            <PillLink href="/sobre-lumia">Conoce a Patricia</PillLink>
          </div>
        </div>
      </section>

      <section
        id="preguntas"
        className={`${container} grid gap-10 pt-20 md:grid-cols-[1fr_2fr] md:gap-16 md:pt-28`}
      >
        <div className="flex flex-col gap-4">
          <h2 className="font-bold text-[2rem] text-ink-900 leading-[1.08] tracking-tight md:text-[2.75rem]">
            Preguntas frecuentes
          </h2>
          <p className="text-ink-800 text-lg leading-relaxed">
            Las dudas que más nos llegan antes de la primera visita.
          </p>
          <Link
            href="/preguntas-frecuentes"
            className="inline-flex items-center gap-2 font-medium text-lg text-sage-800 hover:text-sage-900"
          >
            Ver todas las preguntas
            <ArrowRightIcon className="size-5" />
          </Link>
        </div>
        <FaqAccordion items={featuredFaqs} />
      </section>

      <section
        id="clinica"
        aria-labelledby="clinica-titulo"
        className={`${container} pt-20 md:pt-28`}
      >
        <h2 id="clinica-titulo" className={`${sectionTitle} mb-10`}>
          Visítanos en {site.city}
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          <Image
            src="/patricia-recepcion.jpg"
            alt="Recepción de la clínica LUMIA en Xàtiva"
            width={1024}
            height={1536}
            sizes="(min-width: 768px) 33vw, 100vw"
            className="h-80 w-full rounded-[2rem] object-cover object-[25%_50%] md:h-[28rem]"
          />
          <Image
            src="/patricia-sala.jpg"
            alt="Sala infantil de la clínica LUMIA"
            width={1024}
            height={1536}
            sizes="(min-width: 768px) 33vw, 100vw"
            className="h-80 w-full rounded-[2rem] object-cover object-[30%_50%] md:h-[28rem]"
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
            <div className="flex gap-3">
              <PhoneIcon className="mt-0.5 size-6 shrink-0 text-sage-800" />
              <p className="text-ink-800">
                <span className="block font-bold text-ink-900">
                  {site.phone.display}
                </span>
                Llamada o WhatsApp
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-3">
              {!isPending(site.maps) && (
                <a
                  href={site.maps}
                  target="_blank"
                  rel="noreferrer"
                  className={pillClassName("solid")}
                >
                  Cómo llegar
                </a>
              )}
              <a href={site.phone.href} className={pillClassName("sage")}>
                Llamar
              </a>
            </div>
          </div>
        </div>
        <p className="mt-6 text-ink-800 text-sm leading-relaxed md:text-base">
          También atendemos a pacientes de {nearbyTowns.join(", ")} y otros
          municipios de La Costera.
        </p>
      </section>

      {instagramPosts.length > 0 && (
        <section id="instagram" className={`${container} pt-20 md:pt-28`}>
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <h2 className={sectionTitle}>Síguenos en Instagram</h2>
            {!isPending(site.instagram) && (
              <a
                href={site.instagram}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 font-medium text-lg text-sage-800 hover:text-sage-900"
              >
                Ver en Instagram
                <ArrowRightIcon className="size-5" />
              </a>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
            {instagramPosts.map((post) => (
              <li key={post.id} className="aspect-square">
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block size-full overflow-hidden rounded-[1.75rem]"
                >
                  <Image
                    src={post.imageUrl}
                    alt={post.alt}
                    fill
                    sizes="(min-width: 768px) 22vw, 50vw"
                    className="object-cover"
                  />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CtaBand />
    </>
  );
}
