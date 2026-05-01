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

          <a
            href={`mailto:${EMAIL}`}
            className="inline-flex items-center justify-center rounded-full bg-sage-700 px-6 py-3 text-sm font-medium text-cream-50 transition hover:bg-sage-800"
          >
            {EMAIL}
          </a>
        </div>
      </section>

      <footer className="border-t border-stone-200 px-6 py-8">
        <p className="mx-auto max-w-4xl text-center text-sm text-stone-500">
          © {new Date().getFullYear()} Clínica Lumia · Xàtiva
        </p>
      </footer>
    </main>
  );
}
