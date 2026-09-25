import type { ReactNode } from "react";
import { NavLink } from "./nav-link";

export type NavItem = { href: string; label: string };

export function AppShell({
  logo,
  section,
  nav,
  user,
  logout,
  children,
}: {
  logo: ReactNode;
  section: string;
  nav: NavItem[];
  user: { name: string; detail: string };
  logout: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-50 lg:flex-row">
      <aside className="flex flex-col gap-5 border-line border-b px-5 py-5 lg:w-62 lg:shrink-0 lg:gap-10 lg:border-r lg:border-b-0 lg:pt-9 lg:pb-7">
        <div className="flex flex-col gap-1.5 px-3">
          {logo}
          <span className="text-xs font-medium tracking-[0.12em] text-sage-800 uppercase">
            {section}
          </span>
        </div>
        <nav
          aria-label="Secciones"
          className="flex gap-1 overflow-x-auto lg:flex-1 lg:flex-col"
        >
          {nav.map((item) => (
            <NavLink key={item.href} href={item.href}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center justify-between gap-3 px-3 lg:flex-col lg:items-start lg:border-line lg:border-t lg:pt-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-ink-900">
              {user.name}
            </span>
            <span className="text-[13px] text-ink-800">{user.detail}</span>
          </div>
          {logout}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-8 lg:px-12 lg:py-10">
        {children}
      </main>
    </div>
  );
}
