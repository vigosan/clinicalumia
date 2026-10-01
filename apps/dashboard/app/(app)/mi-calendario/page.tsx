import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { publicOrigin } from "@/lib/public-origin";
import { CalendarLink } from "./CalendarLink";

export const metadata: Metadata = { title: "Calendario del móvil" };

export default async function MyCalendarPage() {
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("my_calendar_token");
  if (error) throw error;

  const url = token
    ? `${publicOrigin(await headers())}/calendario/${token}.ics`
    : null;

  return (
    <>
      <PageHeader
        title="Tus citas en el calendario del móvil"
        description="Suscríbete una vez y tus citas de LUMIA aparecerán en Google Calendar o en el iPhone. Solo se ve el nombre del paciente y el servicio. Las citas se siguen dando y cambiando en la Agenda."
      />
      <Card>
        <CalendarLink url={url} />
      </Card>
      {url && (
        <Card className="flex flex-col gap-4 text-[15px] text-ink-800">
          <p>
            El enlace es personal: quien lo tenga ve tus citas. Si crees que
            alguien más lo tiene, cámbialo.
          </p>
          <div className="flex flex-col gap-1">
            <h2 className="font-bold text-ink-900">Google Calendar</h2>
            <p>
              Desde el ordenador, en calendar.google.com: junto a «Otros
              calendarios», pulsa «+», elige «Desde URL», pega el enlace y pulsa
              «Añadir calendario». Aparecerá también en el móvil.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="font-bold text-ink-900">iPhone</h2>
            <p>
              Abre Ajustes › Calendario › Cuentas › Añadir cuenta › Otra ›
              Añadir calendario suscrito, pega el enlace y pulsa «Siguiente» y
              «Guardar».
            </p>
          </div>
          <p>
            Los calendarios se actualizan solos cada cierto tiempo: un cambio
            puede tardar unas horas en verse.
          </p>
        </Card>
      )}
    </>
  );
}
