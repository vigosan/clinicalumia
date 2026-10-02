import "server-only";
import {
  addDays,
  madridDayBounds,
  weekdayOf,
  weekStart,
} from "@clinicalumia/api/madrid-time";
import { createClient } from "@clinicalumia/api/server";
import type { ScheduleBlock } from "@/lib/agenda";
import { isUuid, visibleHours, visibleWeekHours } from "@/lib/agenda";
import { type Closure, closureOn, loadClosures } from "@/lib/closures";
import { type AgendaPaymentIcon, agendaPaymentIcon } from "@/lib/payments";

export type AgendaColumn = {
  id: string;
  fullName: string;
  role: "owner" | "employee";
  specialtyName: string | null;
  specialtySlug: string | null;
  inactive: boolean;
};

export type AgendaAppointment = {
  id: string;
  professionalId: string;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "no_show";
  origin: "staff" | "web";
  patientName: string;
  serviceName: string;
  paymentIcon: AgendaPaymentIcon | null;
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
  reason: string | null;
};

export type AgendaData = {
  kind: "day";
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
  closure: Closure | null;
  firstHour: number;
  lastHour: number;
};

export type WeekDayData = {
  date: string;
  appointments: AgendaAppointment[];
  timeOff: AgendaTimeOff[];
  schedule: ScheduleBlock[];
  closure: Closure | null;
};

export type WeekAgendaData = {
  kind: "week";
  date: string;
  isOwner: boolean;
  selfId: string;
  personId: string;
  personName: string;
  personSpecialtySlug: string | null;
  candidates: AgendaColumn[];
  days: WeekDayData[];
  firstHour: number;
  lastHour: number;
};

function overlapsDay(
  block: { startsAt: string; endsAt: string },
  day: string,
): boolean {
  const bounds = madridDayBounds(day);
  return (
    new Date(block.startsAt).getTime() < new Date(bounds.end).getTime() &&
    new Date(block.endsAt).getTime() > new Date(bounds.start).getTime()
  );
}

function toAppointment(
  row: {
    id: string;
    professional_id: string;
    starts_at: string;
    ends_at: string;
    status: string;
    origin: string;
    patient: { first_name: string; last_name: string } | null;
    service: { name: string } | null;
    payments: { voided_at: string | null }[];
  },
  now: Date,
): AgendaAppointment {
  const status = row.status as "scheduled" | "no_show";
  return {
    id: row.id,
    professionalId: row.professional_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status,
    origin: row.origin as "staff" | "web",
    patientName: row.patient
      ? `${row.patient.first_name} ${row.patient.last_name}`
      : "",
    serviceName: row.service?.name ?? "",
    paymentIcon: agendaPaymentIcon({
      status,
      startsAt: row.starts_at,
      paid: row.payments.some((payment) => payment.voided_at === null),
      now,
    }),
  };
}

function toTimeOff(row: {
  id: string;
  profile_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
}): AgendaTimeOff {
  return {
    id: row.id,
    professionalId: row.profile_id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    reason: row.reason,
  };
}

export type LoadAgendaResult =
  | { ok: true; data: AgendaData | WeekAgendaData }
  | { ok: false };

export async function loadAgenda({
  date,
  view,
  withIds,
  personId,
}: {
  date: string;
  view: "day" | "week";
  withIds: string[];
  personId: string | null;
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
      inactive: false,
    };
  };

  const isOwner = ownProfile.role === "owner";
  const directoryColumns = directory.map(toColumn);
  const self =
    directoryColumns.find((column) => column.id === ownProfile.id) ??
    toColumn(ownProfile);

  if (view === "week") {
    return loadWeekAgenda(supabase, {
      date,
      isOwner,
      self,
      directoryColumns,
      personId,
      toColumn,
    });
  }

  const validWithIds = withIds.filter(
    (id) => isUuid(id) && directoryColumns.some((c) => c.id === id),
  );

  const activeColumns = isOwner
    ? directoryColumns
    : [
        self,
        ...directoryColumns.filter(
          (column) => column.id !== self.id && validWithIds.includes(column.id),
        ),
      ];
  const activeIds = activeColumns.map((column) => column.id);

  const bounds = madridDayBounds(date);
  const weekday = weekdayOf(date);

  const appointmentsQuery = supabase
    .from("appointments")
    .select(
      "id, professional_id, starts_at, ends_at, status, origin, patient:people(first_name, last_name), service:services(name), payments(voided_at)",
    )
    .neq("status", "cancelled")
    .lt("starts_at", bounds.end)
    .gt("ends_at", bounds.start);

  const [
    { data: appointmentRows, error: appointmentsError },
    { data: timeOffRows, error: timeOffError },
    { data: scheduleRows, error: schedulesError },
    closures,
  ] = await Promise.all([
    isOwner
      ? appointmentsQuery
      : appointmentsQuery.in("professional_id", activeIds),
    supabase.rpc("time_off_between", {
      p_profile_ids: activeIds,
      p_from: bounds.start,
      p_to: bounds.end,
    }),
    supabase
      .from("employee_schedules")
      .select("profile_id, weekday, starts_at, ends_at")
      .in("profile_id", activeIds)
      .eq("weekday", weekday),
    loadClosures(supabase, date, date),
  ]);
  if (appointmentsError || !appointmentRows) return { ok: false };
  if (timeOffError || !timeOffRows) return { ok: false };
  if (schedulesError || !scheduleRows) return { ok: false };
  if (!closures) return { ok: false };

  const formerIds = [
    ...new Set(
      appointmentRows
        .map((row) => row.professional_id)
        .filter((id) => !activeIds.includes(id)),
    ),
  ];
  let formerColumns: AgendaColumn[] = [];
  if (formerIds.length > 0) {
    const { data: formerRows, error: formerError } = await supabase
      .from("profiles")
      .select("id, full_name, role, specialty_id")
      .in("id", formerIds)
      .order("full_name", { ascending: true });
    if (formerError || !formerRows) return { ok: false };
    formerColumns = formerRows.map((row) => ({
      ...toColumn(row),
      inactive: true,
    }));
  }
  const columns = [...activeColumns, ...formerColumns];
  const columnIds = columns.map((column) => column.id);

  const appointments: AgendaAppointment[] = appointmentRows.map((row) =>
    toAppointment(row, new Date()),
  );

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

  const timeOff: AgendaTimeOff[] = timeOffRows.map(toTimeOff);

  const schedulesByColumn: Record<string, ScheduleBlock[]> = {};
  for (const column of columns) {
    schedulesByColumn[column.id] = scheduleRows.filter(
      (row) => row.profile_id === column.id,
    );
  }
  const { firstHour, lastHour } = visibleHours(
    scheduleRows,
    weekday,
    [...appointments, ...busy],
    date,
    timeOff,
  );

  return {
    ok: true,
    data: {
      kind: "day",
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
      closure: closureOn(date, closures),
      firstHour,
      lastHour,
    },
  };
}

async function loadWeekAgenda(
  supabase: Awaited<ReturnType<typeof createClient>>,
  {
    date,
    isOwner,
    self,
    directoryColumns,
    personId,
    toColumn,
  }: {
    date: string;
    isOwner: boolean;
    self: AgendaColumn;
    directoryColumns: AgendaColumn[];
    personId: string | null;
    toColumn: (profile: {
      id: string;
      full_name: string;
      role: "owner" | "employee";
      specialty_id: string | null;
    }) => AgendaColumn;
  },
): Promise<LoadAgendaResult> {
  const start = weekStart(date);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const bounds = {
    start: madridDayBounds(start).start,
    end: madridDayBounds(addDays(start, 6)).end,
  };

  let candidates = isOwner ? directoryColumns : [];
  if (isOwner) {
    const { data: weekRows, error: weekError } = await supabase
      .from("appointments")
      .select("professional_id")
      .neq("status", "cancelled")
      .lt("starts_at", bounds.end)
      .gt("ends_at", bounds.start);
    if (weekError || !weekRows) return { ok: false };
    const formerIds = [
      ...new Set(
        weekRows
          .map((row) => row.professional_id)
          .filter((id) => !directoryColumns.some((c) => c.id === id)),
      ),
    ];
    if (formerIds.length > 0) {
      const { data: formerRows, error: formerError } = await supabase
        .from("profiles")
        .select("id, full_name, role, specialty_id")
        .in("id", formerIds)
        .order("full_name", { ascending: true });
      if (formerError || !formerRows) return { ok: false };
      candidates = [
        ...directoryColumns,
        ...formerRows.map((row) => ({ ...toColumn(row), inactive: true })),
      ];
    }
  }

  const targetPersonId =
    isOwner && personId && candidates.some((c) => c.id === personId)
      ? personId
      : self.id;
  const person =
    candidates.find((column) => column.id === targetPersonId) ?? self;

  const [
    { data: appointmentRows, error: appointmentsError },
    { data: timeOffRows, error: timeOffError },
    { data: scheduleRows, error: schedulesError },
    closures,
  ] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "id, professional_id, starts_at, ends_at, status, origin, patient:people(first_name, last_name), service:services(name), payments(voided_at)",
      )
      .eq("professional_id", targetPersonId)
      .neq("status", "cancelled")
      .lt("starts_at", bounds.end)
      .gt("ends_at", bounds.start),
    supabase.rpc("time_off_between", {
      p_profile_ids: [targetPersonId],
      p_from: bounds.start,
      p_to: bounds.end,
    }),
    supabase
      .from("employee_schedules")
      .select("profile_id, weekday, starts_at, ends_at")
      .eq("profile_id", targetPersonId),
    loadClosures(supabase, start, addDays(start, 6)),
  ]);
  if (appointmentsError || !appointmentRows) return { ok: false };
  if (timeOffError || !timeOffRows) return { ok: false };
  if (schedulesError || !scheduleRows) return { ok: false };
  if (!closures) return { ok: false };

  const appointments = appointmentRows.map((row) =>
    toAppointment(row, new Date()),
  );
  const timeOff = timeOffRows.map(toTimeOff);

  const weekDays: WeekDayData[] = days.map((day) => ({
    date: day,
    appointments: appointments.filter((appointment) =>
      overlapsDay(appointment, day),
    ),
    timeOff: timeOff.filter((entry) => overlapsDay(entry, day)),
    schedule: scheduleRows.filter((row) => row.weekday === weekdayOf(day)),
    closure: closureOn(day, closures),
  }));

  const { firstHour, lastHour } = visibleWeekHours(
    scheduleRows,
    appointments,
    timeOff,
  );

  return {
    ok: true,
    data: {
      kind: "week",
      date,
      isOwner,
      selfId: self.id,
      personId: person.id,
      personName: person.fullName,
      personSpecialtySlug: person.specialtySlug,
      candidates,
      days: weekDays,
      firstHour,
      lastHour,
    },
  };
}
