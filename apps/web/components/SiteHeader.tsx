"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { site } from "@/lib/site";
import { WhatsAppIcon } from "./icons";
import { pillClassName } from "./PillLink";

const navLinks = [
  { href: "/sobre-lumia", label: "Somos LUMIA" },
  { href: "/servicios", label: "Servicios" },
  { href: "/preguntas-frecuentes", label: "Preguntas frecuentes" },
  { href: "/contacto", label: "Contacto" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="absolute inset-x-0 top-0 z-30 px-6 pt-6 md:pt-[2.76vw] md:pr-[7.344vw] md:pl-[3.021vw]">
      <div className="flex items-start justify-between gap-6">
        <Link href="/" aria-label="LUMIA, inicio" className="shrink-0">
          <Image
            src="/logo-white.png"
            alt="LUMIA · Clínica Logopedia miofuncional"
            width={1080}
            height={400}
            priority
            className="h-auto w-40 md:w-[24.583vw]"
          />
        </Link>

        <div className="hidden items-center pt-10 lg:flex">
          <nav className="flex items-center gap-[2.604vw]">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-action text-cream-50 transition-opacity hover:opacity-70"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-[7.344vw] flex items-center gap-[1.354vw]">
            <Link
              href="/contacto"
              className={pillClassName("cream", "min-w-[7.917vw]")}
            >
              Coger cita
            </Link>
            <a
              href={site.phone.href}
              className={pillClassName("cream", "min-w-[7.917vw] gap-3")}
            >
              Llamar
              <WhatsAppIcon className="size-6" />
            </a>
          </div>
        </div>

        <button
          type="button"
          data-testid="menu-toggle"
          aria-expanded={open}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
          onClick={() => setOpen(!open)}
          className="cursor-pointer p-2 text-cream-50 lg:hidden"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="size-7"
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
          className="mt-6 flex flex-col gap-1 rounded-3xl bg-cream-50/95 p-4 lg:hidden"
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-2xl px-4 py-3 text-lg text-ink-600 transition-colors hover:bg-sage-500/15"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <Link
              href="/contacto"
              onClick={() => setOpen(false)}
              className={pillClassName("sage")}
            >
              Coger cita
            </Link>
            <a href={site.phone.href} className={pillClassName("sage")}>
              Llamar {site.phone.display}
            </a>
          </div>
        </nav>
      )}
    </header>
  );
}
