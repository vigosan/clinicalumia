"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPending, site } from "@/lib/site";
import { PhoneIcon, WhatsAppIcon } from "./icons";

const formPaths = ["/reservar", "/acceder", "/mi-cuenta", "/consentimiento"];

const secondary =
  "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-2xl bg-cream-200 font-medium text-sage-900 text-xs";

export function MobileActionBar() {
  const pathname = usePathname();
  if (formPaths.some((path) => pathname.startsWith(path))) return null;

  return (
    <>
      <div aria-hidden className="h-24 bg-sage-500 md:hidden" />
      <nav
        aria-label="Acciones rápidas"
        className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-cream-200 border-t bg-cream-50/95 px-3 pt-2.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden"
      >
        <a href={site.phone.href} className={secondary}>
          <PhoneIcon className="size-5" />
          Llamar
        </a>
        {!isPending(site.whatsapp.href) && (
          <a href={site.whatsapp.href} className={secondary}>
            <WhatsAppIcon className="size-5" />
            WhatsApp
          </a>
        )}
        <Link
          href="/reservar"
          className="flex min-h-14 flex-[1.6] items-center justify-center rounded-2xl bg-sage-800 font-medium text-cream-50"
        >
          Pide tu valoración
        </Link>
      </nav>
    </>
  );
}
