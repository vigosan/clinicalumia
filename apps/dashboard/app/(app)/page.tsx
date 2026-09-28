import {
  isValidDate,
  madridDateTime,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { canMarkNoShow, canMove, isUuid } from "@/lib/agenda";
import { AgendaHeader } from "./agenda/AgendaHeader";
import {
  type AppointmentDetail,
  AppointmentPanel,
} from "./agenda/AppointmentPanel";
import { DayView } from "./agenda/DayView";
import { loadAgenda } from "./agenda/load";
import { SeeAlso } from "./agenda/SeeAlso";
import { WeekView } from "./agenda/WeekView";

function buildHref(base: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

function timeOf(instant: string): string {
  return madridDateTime(instant).time.slice(0, 5);
}

function formatHistoryMoment(instant: string): string {
  const { date, time } = madridDateTime(instant);
  return `${date.slice(8, 10)}/${date.slice(5, 7)} a las ${time.slice(0, 5)}`;
}

type AppointmentEventRow = {
  id: string;
  kind: "created" | "moved" | "cancelled" | "no_show" | "restored";
  previous_starts_at: string | null;
  previous_ends_at: string | null;
  actor_id: string | null;
  created_at: string;
};

function historyLine(
  event: AppointmentEventRow,
  index: number,
  events: AppointmentEventRow[],
  appointment: {
    starts_at: string;
    cancelled_by: "patient" | "clinic" | null;
    cancel_reason: string;
  },
  nameById: Map<string, string>,
): string {
  const actorName = event.actor_id
    ? (nameById.get(event.actor_id) ?? "Alguien")
    : "Alguien";
  const moment = formatHistoryMoment(event.created_at);

  if (event.kind === "created") return `Creada por ${actorName} el ${moment}`;

  if (event.kind === "moved") {
    const nextMove = events
      .slice(index + 1)
      .find((candidate) => candidate.kind === "moved");
    const toStart = nextMove
      ? (nextMove.previous_starts_at ?? appointment.starts_at)
      : appointment.starts_at;
    return `Movida de ${timeOf(event.previous_starts_at ?? toStart)} a ${timeOf(toStart)} por ${actorName} el ${moment}`;
  }

  if (event.kind === "cancelled") {
    const who =
      appointment.cancelled_by === "patient" ? "el paciente" : "la clínica";
    const reasonSuffix = appointment.cancel_reason
      ? ` (${appointment.cancel_reason})`
      : "";
    return `Cancelada por ${who}${reasonSuffix} el ${moment}`;
  }

  if (event.kind === "no_show")
    return `Marcada como no presentada el ${moment}`;

  return `Restaurada el ${moment}`;
}

async function loadAppointmentDetail(
  appointmentId: string | null,
): Promise<AppointmentDetail | null> {
  if (!appointmentId) return null;
  const supabase = await createClient();

  const { data: appt, error } = await supabase
    .from("appointments")
    .select(
      "id, professional_id, starts_at, ends_at, status, notes, price_cents, cancelled_by, cancel_reason, patient:people(id, first_name, last_name), service:services(id, name, duration_minutes)",
    )
    .eq("id", appointmentId)
    .maybeSingle();
  if (error || !appt || !appt.patient || !appt.service) return null;

  const [{ data: events }, { data: directory }] = await Promise.all([
    supabase
      .from("appointment_events")
      .select(
        "id, kind, previous_starts_at, previous_ends_at, actor_id, created_at",
      )
      .eq("appointment_id", appointmentId)
      .order("created_at", { ascending: true }),
    supabase.rpc("staff_directory"),
  ]);

  const nameById = new Map(
    (directory ?? []).map((profile) => [profile.id, profile.full_name]),
  );
  const professionalName = nameById.get(appt.professional_id) ?? "Profesional";

  const eventRows = (events ?? []) as AppointmentEventRow[];
  const history = eventRows.map((event, index) => ({
    id: event.id,
    text: historyLine(event, index, eventRows, appt, nameById),
  }));

  const now = new Date();
  const initial = madridDateTime(appt.starts_at);

  return {
    id: appt.id,
    patientId: appt.patient.id,
    patientName: `${appt.patient.first_name} ${appt.patient.last_name}`,
    professionalId: appt.professional_id,
    professionalName,
    serviceId: appt.service.id,
    serviceName: appt.service.name,
    durationMinutes: appt.service.duration_minutes,
    startsAt: appt.starts_at,
    endsAt: appt.ends_at,
    status: appt.status,
    notes: appt.notes,
    priceCents: appt.price_cents,
    canMove: canMove({ status: appt.status, starts_at: appt.starts_at }, now),
    canMarkNoShow: canMarkNoShow(
      { status: appt.status, starts_at: appt.starts_at },
      now,
    ),
    canCancel: appt.status === "scheduled",
    canRestore: appt.status === "no_show",
    initialDate: initial.date,
    initialTime: initial.time.slice(0, 5),
    history,
  };
}

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    view?: string;
    with?: string;
    person?: string;
    appointment?: string;
  }>;
}) {
  const params = await searchParams;
  const date =
    params.date && isValidDate(params.date) ? params.date : todayInMadrid();
  const view = params.view === "week" ? "week" : "day";
  const withIds = (params.with ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => isUuid(id));
  const personId =
    params.person && isUuid(params.person) ? params.person : null;
  const appointmentId =
    params.appointment && isUuid(params.appointment)
      ? params.appointment
      : null;

  const [result, appointment] = await Promise.all([
    loadAgenda({ date, view, withIds, personId }),
    loadAppointmentDetail(appointmentId),
  ]);

  if (!result.ok) {
    return (
      <Card
        role="alert"
        className="text-center text-danger-600 text-sm"
        data-testid="agenda-error"
      >
        No se ha podido cargar la agenda.
      </Card>
    );
  }

  const { data } = result;

  if (data.kind === "week") {
    const personParam = data.personId !== data.selfId ? data.personId : "";
    return (
      <div className="flex flex-col gap-6">
        <AgendaHeader
          date={data.date}
          view={view}
          withParam=""
          personParam={personParam}
          dayToWeekPerson=""
          isOwner={data.isOwner}
          selfId={data.selfId}
        />
        <WeekView
          date={data.date}
          isOwner={data.isOwner}
          personId={data.personId}
          personName={data.personName}
          personSpecialtySlug={data.personSpecialtySlug}
          candidates={data.candidates}
          days={data.days}
          firstHour={data.firstHour}
          lastHour={data.lastHour}
        />
        {appointment && (
          <AppointmentPanel
            appointment={appointment}
            closeHref={buildHref("/", {
              date: data.date,
              view,
              person: personParam,
            })}
          />
        )}
      </div>
    );
  }

  const withParam = data.selectedColleagueIds.join(",");
  const ownerSelectedIds = withIds.filter((id) =>
    data.candidates.some((candidate) => candidate.id === id),
  );
  const dayToWeekPerson =
    data.isOwner && ownerSelectedIds.length === 1
      ? (ownerSelectedIds[0] ?? "")
      : "";

  return (
    <div className="flex flex-col gap-6">
      <AgendaHeader
        date={data.date}
        view={view}
        withParam={withParam}
        personParam=""
        dayToWeekPerson={dayToWeekPerson}
        isOwner={data.isOwner}
        selfId={data.selfId}
      />
      {!data.isOwner && (
        <SeeAlso
          date={data.date}
          view={view}
          candidates={data.candidates}
          selectedIds={data.selectedColleagueIds}
        />
      )}
      <DayView
        date={data.date}
        view={view}
        withParam={withParam}
        selfId={data.selfId}
        columns={data.columns}
        appointments={data.appointments}
        busy={data.busy}
        timeOff={data.timeOff}
        schedulesByColumn={data.schedulesByColumn}
        firstHour={data.firstHour}
        lastHour={data.lastHour}
      />
      {appointment && (
        <AppointmentPanel
          appointment={appointment}
          closeHref={buildHref("/", { date: data.date, view, with: withParam })}
        />
      )}
    </div>
  );
}
