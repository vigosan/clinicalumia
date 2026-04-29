export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center min-h-screen bg-white px-6">
      <div className="flex flex-col items-center gap-8 text-center">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-medium tracking-[0.2em] uppercase text-slate-400">
            Xàtiva
          </span>
          <h1 className="text-4xl font-light tracking-tight text-slate-900 sm:text-5xl">
            Clínica Lumia
          </h1>
        </div>

        <div className="h-px w-12 bg-slate-200" />

        <p className="max-w-sm text-base text-slate-500 leading-relaxed">
          Próximamente. Atención médica personalizada y de calidad.
        </p>

        <a
          href="mailto:info@clinicalumia.es"
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
        >
          info@clinicalumia.es
        </a>
      </div>
    </main>
  );
}
