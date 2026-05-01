const PHONE = "+34962000000";
const WHATSAPP = "34962000000";
const EMAIL = "info@clinicalumia.es";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="flex max-w-2xl flex-col items-center gap-10 text-center">
          <span className="text-xs font-medium uppercase tracking-[0.3em] text-sage-700">
            Xàtiva · Próximamente
          </span>

          <h1 className="font-display text-5xl font-light leading-[1.05] tracking-tight text-stone-900 sm:text-6xl">
            Clínica Lumia
          </h1>

          <p className="max-w-md text-lg leading-relaxed text-stone-600">
            Una nueva clínica en Xàtiva con atención cercana, personalizada y
            de calidad para toda la familia.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <a
              href={`https://wa.me/${WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-sage-700 px-6 py-3 text-sm font-medium text-cream-50 transition hover:bg-sage-800"
            >
              Escríbenos por WhatsApp
            </a>
            <a
              href={`mailto:${EMAIL}`}
              className="inline-flex items-center justify-center rounded-full border border-stone-300 px-6 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-500 hover:text-stone-900"
            >
              {EMAIL}
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200 px-6 py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-3 text-sm text-stone-500 sm:flex-row">
          <p>© {new Date().getFullYear()} Clínica Lumia · Xàtiva</p>
          <a href={`tel:${PHONE}`} className="hover:text-stone-800">
            {PHONE}
          </a>
        </div>
      </footer>
    </main>
  );
}
