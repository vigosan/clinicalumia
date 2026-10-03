"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { site } from "@/lib/site";
import { pillClassName } from "./PillLink";

const navLinks = [
  { href: "/sobre-lumia", label: "Somos LUMIA" },
  { href: "/servicios", label: "Servicios" },
  { href: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
  { href: "/contacto", label: "Contacto" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const overPhoto = pathname === "/";
  const linkTone = overPhoto ? "text-cream-50" : "text-ink-900";

  return (
    <header className="absolute inset-x-0 top-0 z-30 px-6 pt-6 md:px-[4.5vw] md:pt-8">
      <div className="flex items-center justify-between gap-6">
        <Link href="/" aria-label="LUMIA, inicio" className="shrink-0">
          <Image
            src="/logo-white.png"
            alt="LUMIA · Clínica Logopedia miofuncional"
            width={1080}
            height={400}
            priority
            className="h-auto w-36 md:w-48 xl:w-52"
          />
        </Link>

        <div className="hidden items-center gap-10 xl:flex">
          <nav className="flex items-center gap-8">
            {navLinks.map((link) => {
              const current = pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={current ? "page" : undefined}
                  className={`whitespace-nowrap font-medium text-base ${linkTone} decoration-2 underline-offset-8 transition-opacity hover:opacity-70 aria-[current=page]:underline`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-6">
            <Link
              href="/mi-cuenta"
              aria-current={
                pathname.startsWith("/mi-cuenta") ? "page" : undefined
              }
              className={`whitespace-nowrap font-medium text-base ${linkTone} transition-opacity hover:opacity-70`}
            >
              Mi cuenta
            </Link>
            <Link
              href="/reservar"
              className={pillClassName(
                overPhoto ? "light" : "solid",
                "whitespace-nowrap",
              )}
            >
              Pide tu valoración
            </Link>
          </div>
        </div>

        <button
          type="button"
          data-testid="menu-toggle"
          aria-expanded={open}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen(!open)}
          className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-cream-50/90 text-ink-900 xl:hidden"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="size-6"
          >
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <nav
          data-testid="mobile-menu"
          className="mt-6 flex flex-col gap-1 rounded-3xl bg-cream-50 p-4 shadow-lg xl:hidden"
        >
          {[...navLinks, { href: "/mi-cuenta", label: "Mi cuenta" }].map(
            (link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={
                  pathname.startsWith(link.href) ? "page" : undefined
                }
                className="rounded-2xl px-4 py-3 text-ink-900 text-lg transition-colors hover:bg-sage-500/15 aria-[current=page]:bg-cream-200"
              >
                {link.label}
              </Link>
            ),
          )}
          <div className="mt-2 flex flex-col gap-2">
            <Link
              href="/reservar"
              onClick={() => setOpen(false)}
              className={pillClassName("solid")}
            >
              Pide tu valoración
            </Link>
            <a href={site.phone.href} className={pillClassName("sage")}>
              Llamar al {site.phone.display}
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
