import Link from "next/link";

export default function AdminHome() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Bienvenida</h1>
      <p className="text-slate-600">Gestiona la clínica desde aquí.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/specialties"
          className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-slate-400"
        >
          <h2 className="font-medium text-slate-900">Especialidades</h2>
          <p className="text-sm text-slate-500">
            Catálogo de especialidades clínicas.
          </p>
        </Link>

        <Link
          href="/team"
          className="rounded-xl border border-slate-200 bg-white p-6 transition hover:border-slate-400"
        >
          <h2 className="font-medium text-slate-900">Equipo</h2>
          <p className="text-sm text-slate-500">
            Médicos y personal de la clínica.
          </p>
        </Link>
      </div>
    </div>
  );
}
