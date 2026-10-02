import { isValidDate, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { Alert } from "@clinicalumia/ui/alert";
import type { Metadata } from "next";
import { isUuid } from "@/lib/agenda";
import { AgendaHeader } from "./agenda/AgendaHeader";
import { AppointmentPanel } from "./agenda/AppointmentPanel";
import { DayView } from "./agenda/DayView";
import { loadAgenda } from "./agenda/load";
import { loadAppointmentDetail } from "./agenda/load-detail";
import { NewAppointmentDrawer } from "./agenda/NewAppointmentDrawer";
import { SeeAlso } from "./agenda/SeeAlso";
import { WeekView } from "./agenda/WeekView";
import { loadAppointmentForm } from "./appointments/load-form";

function buildHref(base: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}

export const metadata: Metadata = { title: "Agenda" };

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    view?: string;
    with?: string;
    person?: string;
    appointment?: string;
    new?: string;
    time?: string;
    professional?: string;
    patient?: string;
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

  const [result, appointment, newAppointment] = await Promise.all([
    loadAgenda({ date, view, withIds, personId }),
    loadAppointmentDetail(appointmentId),
    loadAppointmentForm({
      date,
      time: params.time,
      professional: params.professional,
      patient: params.patient,
    }),
  ]);
  const newAppointmentForm = newAppointment?.ok ? newAppointment.form : null;

  if (!result.ok) {
    return (
      <Alert data-testid="agenda-error">
        No se ha podido cargar la agenda.
      </Alert>
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
        <NewAppointmentDrawer
          closeHref={buildHref("/", {
            date: data.date,
            view,
            person: personParam,
          })}
          form={newAppointmentForm}
        />
        <AppointmentPanel
          serverAppointmentId={appointmentId}
          serverResult={appointment}
          appointments={data.days.flatMap((day) => day.appointments)}
          columnOrder={[]}
          closeHref={buildHref("/", {
            date: data.date,
            view,
            person: personParam,
          })}
          linkParams={{ date: data.date, view: "week", person: data.personId }}
        />
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
        closure={data.closure}
        firstHour={data.firstHour}
        lastHour={data.lastHour}
      />
      <NewAppointmentDrawer
        closeHref={buildHref("/", { date: data.date, with: withParam })}
        form={newAppointmentForm}
      />
      <AppointmentPanel
        serverAppointmentId={appointmentId}
        serverResult={appointment}
        appointments={data.appointments}
        columnOrder={data.columns.map((column) => column.id)}
        closeHref={buildHref("/", { date: data.date, view, with: withParam })}
        linkParams={{ date: data.date, view, with: withParam }}
      />
    </div>
  );
}
