import { todayInMadrid } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHero } from "@/components/PageHero";
import {
  type AppointmentRow,
  accountError,
  canMoveTo,
  changeWindowText,
} from "@/lib/account";
import {
  bookingState,
  formatWhen,
  isTeamSession,
  SLOT_TAKEN,
} from "@/lib/booking";
import { pageMetadata } from "@/lib/metadata";
import { site } from "@/lib/site";
import { loadHorizonDays, loadSlots } from "../../../../reservar/load";
import { SlotPicker } from "../../../../reservar/SlotPicker";
import { pickerDays, slotWindow } from "../../../../reservar/step";
import { TeamSession } from "../../../../reservar/TeamSession";
import { requirePatientPage } from "../../../session";
import { RescheduleForm } from "./RescheduleForm";

export const metadata: Metadata = {
  ...pageMetadata({
    title: "Cambiar cita · Clínica LUMIA en Xàtiva",
    description: "Cambia la hora de tu cita en LUMIA.",
    path: "/mi-cuenta",
  }),
  robots: { index: false },
};

const linkClass =
  "font-medium text-sage-600 underline-offset-2 hover:underline";

function cambiar(id: string, fecha: string, inicio?: string) {
  return `/mi-cuenta/citas/${id}/cambiar?${bookingState.encode({ fecha, inicio })}`;
}

function PhoneLink() {
  return (
    <a href={site.phone.href} className={linkClass}>
      {site.phone.display}
    </a>
  );
}

async function Slots({
  appointment,
  from,
  nextFrom,
  today,
  now,
  slotTaken,
}: {
  appointment: AppointmentRow;
  from: string;
  nextFrom: string | null;
  today: string;
  now: Date;
  slotTaken: boolean;
}) {
  const slots = await loadSlots(
    appointment.service_id,
    appointment.professional_id,
    from,
  );
  const days = pickerDays(
    slots.filter((slot) => canMoveTo(appointment, slot.starts_at, now)),
    today,
    (slot) => cambiar(appointment.id, from, slot.starts_at),
  );
  return (
    <div className="mt-10">
      <h2 className="mb-6 font-bold text-ink-600 text-xl">
        Elige la nueva hora con {appointment.professional_name}
      </h2>
      {slotTaken && (
        <p
          role="alert"
          data-testid="account-error"
          className="mb-6 rounded-2xl bg-cream-100 px-4 py-3 text-ink-600 text-sm"
        >
          {accountError({ message: "slot_not_available" })}
        </p>
      )}
      {days.length > 0 ? (
        <SlotPicker key={from} days={days} />
      ) : (
        <p
          data-testid="booking-no-slots"
          className="rounded-2xl bg-cream-50 px-5 py-4 text-ink-600"
        >
          No hay huecos estos días. Llámanos al <PhoneLink /> y te buscamos uno.
        </p>
      )}
      {nextFrom && (
        <Link
          href={cambiar(appointment.id, nextFrom)}
          data-testid="booking-next-days"
          className="mt-8 inline-flex h-11 items-center rounded-full border-2 border-sage-500 px-6 text-sage-600 transition-colors hover:bg-sage-500 hover:text-cream-50"
        >
          Siguientes días
        </Link>
      )}
    </div>
  );
}

function Chosen({
  appointment,
  from,
  startsAt,
}: {
  appointment: AppointmentRow;
  from: string;
  startsAt: string;
}) {
  return (
    <div className="mt-10">
      <Link
        href={cambiar(appointment.id, from)}
        className="text-sage-600 text-sm underline-offset-2 hover:underline"
      >
        ← Elegir otra hora
      </Link>
      <dl
        data-testid="reschedule-summary"
        className="mt-4 flex flex-col gap-3 rounded-3xl bg-cream-50 px-6 py-5 text-ink-600"
      >
        <div>
          <dt className="text-ink-500 text-sm">De</dt>
          <dd>{formatWhen(appointment.starts_at)}</dd>
        </div>
        <div>
          <dt className="text-ink-500 text-sm">A</dt>
          <dd className="font-bold">{formatWhen(startsAt)}</dd>
        </div>
      </dl>
      <RescheduleForm
        appointmentId={appointment.id}
        startsAt={startsAt}
        from={from}
      />
    </div>
  );
}

export default async function CambiarCitaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const state = bookingState.decode(await searchParams);
  await requirePatientPage(`/mi-cuenta/citas/${id}/cambiar`);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_appointments");
  if (isTeamSession(error)) return <TeamSession />;
  if (error) throw error;
  const appointment = data.find(
    (candidate) => candidate.id === id && candidate.status === "scheduled",
  );
  if (!appointment) notFound();

  const movable = appointment.can_change && appointment.can_reschedule;
  const now = new Date();
  const today = todayInMadrid();
  const range = movable
    ? slotWindow({
        fecha: state.fecha,
        today,
        horizonDays: await loadHorizonDays(),
      })
    : null;
  const chosen =
    state.inicio && canMoveTo(appointment, state.inicio, now)
      ? state.inicio
      : null;

  return (
    <>
      <PageHero />
      <section className="px-6 py-14 md:px-12 md:py-20">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-bold text-ink-600 text-section">
            Cambiar la hora
          </h1>
          <div
            data-testid="reschedule-current"
            className="mt-8 rounded-3xl bg-cream-50 px-6 py-5 text-ink-600"
          >
            <p className="font-bold">{formatWhen(appointment.starts_at)}</p>
            <p className="mt-1">
              {appointment.service_name} · {appointment.professional_name}
            </p>
            <p className="mt-1 text-ink-500">Para {appointment.person_name}</p>
            <p className="mt-3 text-ink-500 text-sm">
              {changeWindowText(appointment)}
            </p>
          </div>
          {appointment.can_change && !appointment.can_reschedule && (
            <p
              data-testid="reschedule-phone-only"
              className="mt-8 text-ink-600"
            >
              Esta cita no se puede cambiar desde la web. Llama al <PhoneLink />
              .
            </p>
          )}
          {range && chosen && (
            <Chosen
              appointment={appointment}
              from={range.from}
              startsAt={chosen}
            />
          )}
          {range && !chosen && (
            <Slots
              appointment={appointment}
              from={range.from}
              nextFrom={range.nextFrom}
              today={today}
              now={now}
              slotTaken={state.aviso === SLOT_TAKEN}
            />
          )}
          <Link href="/mi-cuenta" className={`mt-8 inline-block ${linkClass}`}>
            Volver a Mi cuenta
          </Link>
        </div>
      </section>
    </>
  );
}
