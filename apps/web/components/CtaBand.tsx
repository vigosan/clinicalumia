import type { ReactNode } from "react";
import { isPending, site } from "@/lib/site";
import { WhatsAppIcon } from "./icons";
import { PillLink, pillClassName } from "./PillLink";

export function CtaBand({ children }: { children?: ReactNode }) {
  return (
    <section className="mx-auto max-w-[78rem] px-6 pt-20 pb-24 md:px-12 md:pt-28 md:pb-32">
      <div className="flex flex-col gap-8 rounded-panel bg-sage-500 px-6 py-12 md:flex-row md:items-center md:justify-between md:px-16 md:py-16">
        <div className="flex max-w-xl flex-col gap-3">
          <h2 className="font-bold text-[1.75rem] text-ink-900 leading-[1.1] tracking-tight md:text-[2.75rem]">
            Dar el primer paso también forma parte del tratamiento.
          </h2>
          {children}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <PillLink href="/reservar" tone="solid">
            Pide tu primera valoración
          </PillLink>
          {!isPending(site.whatsapp.href) && (
            <a href={site.whatsapp.href} className={pillClassName("light")}>
              <WhatsAppIcon className="size-5" />
              WhatsApp
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
