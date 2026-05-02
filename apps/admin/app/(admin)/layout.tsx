import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@clinicalumia/api/server";
import { logout } from "./actions";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "owner") {
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="font-semibold text-slate-900">
              Clínica Lumia · Admin
            </Link>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              <Link href="/specialties" className="hover:text-slate-900">
                Especialidades
              </Link>
              <Link href="/team" className="hover:text-slate-900">
                Equipo
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">{profile?.full_name ?? user.email}</span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
