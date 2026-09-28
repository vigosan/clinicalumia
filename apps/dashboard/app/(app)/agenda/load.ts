import "server-only";
import { madridDayBounds, weekdayOf } from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import type { ScheduleBlock } from "@/lib/agenda";
import { visibleHours } from "@/lib/agenda";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AgendaColumn = {
  id: string;
  fullName: string;
  role: "owner" | "employee";
  specialtyName: string | null;
  specialtySlug: string | null;
};

export type AgendaAppointment = {
  id: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "no_show";
  patientName: string;
  serviceName: string;
};

export type AgendaBusy = {
  professionalId: string;
  startsAt: string;
  endsAt: string;
};

export type AgendaTimeOff = {
  id: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  reason: string;
};

export type AgendaData = {
  date: string;
  isOwner: boolean;
  selfId: string;
  columns: AgendaColumn[];
  candidates: AgendaColumn[];
  selectedColleagueIds: string[];
  appointments: AgendaAppointment[];
  busy: AgendaBusy[];
  timeOff: AgendaTimeOff[];
  schedulesByColumn: Record<string, ScheduleBlock[]>;
  firstHour: number;
  lastHour: number;
};

export type LoadAgendaResult = { ok: true; data: AgendaData } | { ok: false };

export async function loadAgenda({
  date,
  withIds,
}: {
  date: string;
  view: "day" | "week";
  withIds: string[];
}): Promise<LoadAgendaResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const { data: ownProfile, error: ownProfileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, specialty_id")
    .eq("id", user.id)
    .single();
  if (ownProfileError || !ownProfile) return { ok: false };

  const [
    { data: specialties, error: specialtiesError },
    { data: directory, error: directoryError },
  ] = await Promise.all([
    supabase.from("specialties").select("id, name, slug"),
    supabase.rpc("staff_directory"),
  ]);
  if (specialtiesError || !specialties) return { ok: false };
  if (directoryError || !directory) return { ok: false };

  const specialtyById = new Map(specialties.map((s) => [s.id, s]));
  const toColumn = (profile: {
    id: string;
    full_name: string;
    role: "owner" | "employee";
    specialty_id: string | null;
  }): AgendaColumn => {
    const specialty = profile.specialty_id
      ? specialtyById.get(profile.specialty_id)
      : undefined;
    return {
      id: profile.id,
      fullName: profile.full_name,
      role: profile.role,
      specialtyName: specialty?.name ?? null,
      specialtySlug: specialty?.slug ?? null,
    };
  };

  const isOwner = ownProfile.role === "owner";
  const directoryColumns = directory.map(toColumn);
  const self =
    directoryColumns.find((column) => column.id === ownProfile.id) ??
    toColumn(ownProfile);

  const validWithIds = withIds.filter(
    (id) => UUID_RE.test(id) && directoryColumns.some((c) => c.id === id),
  );

  const columns = isOwner
    ? directoryColumns
    : [
        self,
        ...directoryColumns.filter(
          (column) => column.id !== self.id && validWithIds.includes(column.id),
        ),
      ];
  const columnIds = columns.map((column) => column.id);

  const bounds = madridDayBounds(date);
  const weekday = weekdayOf(date);

  const [
    { data: appointmentRows, error: appointmentsError },
    { data: timeOffRows, error: timeOffError },
    { data: scheduleRows, error: schedulesError },
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, professional_id, starts_at, ends_at, status, patient:people(first_name, last_name), service:services(name)",
      )
      .in("professional_id", columnIds)
      .neq("status", "cancelled")
      .lt("starts_at", bounds.end)
      .gt("ends_at", bounds.start),
    supabase
      .from("employee_time_off")
      .select("id, profile_id, starts_at, ends_at, reason")
      .in("profile_id", columnIds)
      .lt("starts_at", bounds.end)
      .gt("ends_at", bounds.start),
    supabase
      .from("employee_schedules")
      .select("profile_id, weekday, starts_at, ends_at")
      .in("profile_id", columnIds)
      .eq("weekday", weekday),
  ]);
  if (appointmentsError || !appointmentRows) return { ok: false };
  if (timeOffError || !timeOffRows) return { ok: false };
  if (schedulesError || !scheduleRows) return { ok: false };

  const appointments: AgendaAppointment[] = appointmentRows.map((row) => ({
    id: row.id,
    professionalId: row.professional_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status as "scheduled" | "no_show",
    patientName: row.patient
      ? `${row.patient.first_name} ${row.patient.last_name}`
      : "",
    serviceName: row.service?.name ?? "",
  }));

  const colleagueIds = isOwner ? [] : columnIds.filter((id) => id !== self.id);

  let busy: AgendaBusy[] = [];
  if (colleagueIds.length > 0) {
    const { data: busyRows, error: busyError } = await supabase.rpc(
      "agenda_busy",
      { p_from: bounds.start, p_to: bounds.end },
    );
    if (busyError || !busyRows) return { ok: false };
    busy = busyRows
      .filter((row) => colleagueIds.includes(row.professional_id))
      .map((row) => ({
        professionalId: row.professional_id,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
      }));
  }

  const timeOff: AgendaTimeOff[] = timeOffRows.map((row) => ({
    id: row.id,
    professionalId: row.profile_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
  }));

  const schedulesByColumn: Record<string, ScheduleBlock[]> = {};
  for (const column of columns) {
    schedulesByColumn[column.id] = scheduleRows.filter(
      (row) => row.profile_id === column.id,
    );
  }
  const { firstHour, lastHour } = visibleHours(scheduleRows, weekday);

  return {
    ok: true,
    data: {
      date,
      isOwner,
      selfId: self.id,
      columns,
      candidates: directoryColumns.filter((column) => column.id !== self.id),
      selectedColleagueIds: colleagueIds,
      appointments,
      busy,
      timeOff,
      schedulesByColumn,
      firstHour,
      lastHour,
    },
  };
}
