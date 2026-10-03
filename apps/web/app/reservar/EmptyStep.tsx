import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRightIcon,
  MailIcon,
  PhoneIcon,
  WhatsAppIcon,
} from "@/components/icons";
import { isPending, site } from "@/lib/site";

function Option({
  href,
  icon,
  title,
  detail,
  primary = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  detail: string;
  primary?: boolean;
}) {
  const tone = primary
    ? "bg-sage-800 text-cream-50 hover:bg-sage-900"
    : "bg-white text-ink-900 hover:shadow-[0_12px_32px_rgb(58_58_58/0.08)]";
  const detailTone = primary ? "text-cream-50" : "text-ink-800";
  return (
    <a
      href={href}
      className={`flex items-center gap-4 rounded-[1.75rem] p-6 transition ${tone}`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="font-bold text-xl">{title}</span>
        <span className={`text-sm ${detailTone}`}>{detail}</span>
      </span>
      <ArrowRightIcon className="size-5 shrink-0" />
    </a>
  );
}

export function EmptyStep() {
  const afternoon = site.schedule.find((slot) => slot.days === "Tarde");

  return (
    <div>
      <h1 className="font-bold text-[2.5rem] text-ink-900 leading-[1.04] tracking-tight md:text-[3.5rem]">
        Reservar cita
      </h1>
      <div
        data-testid="booking-empty"
        className="mt-8 rounded-3xl bg-sage-100 px-6 py-5 text-ink-900"
      >
        <p className="font-bold text-lg">
          Ahora mismo no quedan huecos para reservar online.
        </p>
        <p className="mt-1">
          Te buscamos uno por teléfono o WhatsApp: es la forma más rápida.
        </p>
      </div>
      <div className="mt-6 flex flex-col gap-3">
        <Option
          primary
          href={site.phone.href}
          icon={<PhoneIcon className="size-7" />}
          title="Llámanos"
          detail={
            afternoon
              ? `${site.phone.display} · tarde ${afternoon.hours}`
              : site.phone.display
          }
        />
        {!isPending(site.whatsapp.href) && (
          <Option
            href={site.whatsapp.href}
            icon={<WhatsAppIcon className="size-7 text-sage-800" />}
            title="Escríbenos por WhatsApp"
            detail="Cuando te venga bien"
          />
        )}
        <Option
          href="/contacto"
          icon={<MailIcon className="size-7 text-sage-800" />}
          title="Te llamamos nosotros"
          detail="Déjanos tus datos y el motivo de consulta"
        />
      </div>
      <p className="mt-8 text-ink-800">
        ¿Ya eres paciente? Consulta o cambia tus citas en{" "}
        <Link
          href="/mi-cuenta"
          className="font-medium text-sage-800 underline underline-offset-2"
        >
          Mi cuenta
        </Link>
        .
      </p>
    </div>
  );
}
