import {
  addDays,
  isValidDate,
  isValidTime,
  madridDateTime,
  madridInstant,
  weekdayOf,
} from "@clinicalumia/api/madrid-time";

export type Block = {
  id: string;
  kind: "own" | "busy" | "time_off";
  professionalId: string;
  start: string;
  end: string;
  label?: string;
  noShow?: boolean;
};

export type DayLayoutBlock = {
  id: string;
  kind: Block["kind"];
  top: number;
  height: number;
  lane: number;
  lanes: number;
};

function minutesFromFirstHour(
  instant: string,
  date: string,
  firstHour: number,
): number {
  const wall = madridDateTime(instant);
  if (wall.date < date) return -Infinity;
  if (wall.date > date) return Infinity;
  const hours = Number(wall.time.slice(0, 2));
  const minutes = Number(wall.time.slice(3, 5));
  return (hours - firstHour) * 60 + minutes;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function layoutDay(
  blocks: Block[],
  date: string,
  firstHour: number,
  lastHour: number,
): DayLayoutBlock[] {
  const windowMinutes = (lastHour - firstHour) * 60;
  const laidOut: (DayLayoutBlock & {
    professionalId: string;
    noShow: boolean;
  })[] = [];
  for (const block of blocks) {
    const top = clamp(
      minutesFromFirstHour(block.start, date, firstHour),
      0,
      windowMinutes,
    );
    const bottom = clamp(
      minutesFromFirstHour(block.end, date, firstHour),
      0,
      windowMinutes,
    );
    if (bottom <= top) continue;
    laidOut.push({
      id: block.id,
      kind: block.kind,
      professionalId: block.professionalId,
      noShow: block.noShow ?? false,
      top,
      height: bottom - top,
      lane: 0,
      lanes: 1,
    });
  }
  assignLanes(laidOut.filter((entry) => entry.kind === "own"));
  return laidOut.map(({ id, kind, top, height, lane, lanes }) => ({
    id,
    kind,
    top,
    height,
    lane,
    lanes,
  }));
}

function assignLanes(
  entries: (DayLayoutBlock & { professionalId: string; noShow: boolean })[],
): void {
  const byProfessional = new Map<string, typeof entries>();
  for (const entry of entries)
    byProfessional.set(entry.professionalId, [
      ...(byProfessional.get(entry.professionalId) ?? []),
      entry,
    ]);
  for (const group of byProfessional.values()) {
    const sorted = [...group].sort(
      (a, b) =>
        a.top - b.top ||
        Number(a.noShow) - Number(b.noShow) ||
        a.id.localeCompare(b.id),
    );
    let cluster: DayLayoutBlock[] = [];
    let laneEnds: number[] = [];
    const closeCluster = () => {
      for (const entry of cluster) entry.lanes = laneEnds.length;
      cluster = [];
      laneEnds = [];
    };
    for (const entry of sorted) {
      if (cluster.length > 0 && entry.top >= Math.max(...laneEnds))
        closeCluster();
      const free = laneEnds.findIndex((end) => end <= entry.top);
      entry.lane = free === -1 ? laneEnds.length : free;
      laneEnds[entry.lane] = entry.top + entry.height;
      cluster.push(entry);
    }
    closeCluster();
  }
}

export type ScheduleBlock = {
  weekday: number;
  starts_at: string;
  ends_at: string;
};

export type TimeSpan = { startsAt: string; endsAt: string };

function minutesOfDay(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function scheduleSpan(block: ScheduleBlock): [number, number] {
  return [minutesOfDay(block.starts_at), minutesOfDay(block.ends_at)];
}

function intersectsDay(block: TimeSpan, date: string): boolean {
  const start = madridDateTime(block.startsAt).date;
  const end = madridDateTime(block.endsAt).date;
  return start <= date && end >= date;
}

function blockSpan(block: TimeSpan, date: string): [number, number] {
  const start = madridDateTime(block.startsAt);
  const end = madridDateTime(block.endsAt);
  const startMinutes = start.date < date ? 0 : minutesOfDay(start.time);
  const endMinutes = end.date > date ? 24 * 60 : minutesOfDay(end.time);
  return [startMinutes, endMinutes];
}

function hoursSpan(spans: [number, number][]): {
  firstHour: number;
  lastHour: number;
} {
  if (spans.length === 0) return { firstHour: 8, lastHour: 20 };
  const firstHour = Math.floor(Math.min(...spans.map(([start]) => start)) / 60);
  const lastHour = Math.ceil(Math.max(...spans.map(([, end]) => end)) / 60);
  if (lastHour <= firstHour) return { firstHour, lastHour: firstHour + 1 };
  return { firstHour, lastHour };
}

function showingAbsences(
  hours: { firstHour: number; lastHour: number },
  absenceSpans: [number, number][],
): { firstHour: number; lastHour: number } {
  let { firstHour, lastHour } = hours;
  for (const [start, end] of absenceSpans) {
    if (end <= start) continue;
    if (end > firstHour * 60 && start < lastHour * 60) continue;
    firstHour = Math.min(firstHour, Math.floor(start / 60));
    lastHour = Math.max(lastHour, Math.ceil(end / 60));
  }
  return { firstHour, lastHour };
}

export function visibleHours(
  schedules: ScheduleBlock[],
  weekday: number,
  blocks: TimeSpan[] = [],
  date = "",
  absences: TimeSpan[] = [],
): { firstHour: number; lastHour: number } {
  const scheduleSpans = schedules
    .filter((schedule) => schedule.weekday === weekday)
    .map(scheduleSpan);
  const blockSpans = date
    ? blocks
        .filter((block) => intersectsDay(block, date))
        .map((block) => blockSpan(block, date))
    : [];
  const absenceSpans = date
    ? absences
        .filter((absence) => intersectsDay(absence, date))
        .map((absence) => blockSpan(absence, date))
    : [];
  return showingAbsences(
    hoursSpan([...scheduleSpans, ...blockSpans]),
    absenceSpans,
  );
}

export function visibleWeekHours(
  schedules: ScheduleBlock[],
  blocks: TimeSpan[] = [],
  absences: TimeSpan[] = [],
  week: { from: string; to: string } = { from: "", to: "" },
): { firstHour: number; lastHour: number } {
  const blockSpans = blocks.map((block) =>
    blockSpan(block, madridDateTime(block.startsAt).date),
  );
  const absenceSpans = absences.flatMap((absence) =>
    [madridDateTime(absence.startsAt).date, madridDateTime(absence.endsAt).date]
      .filter((day) => day >= week.from && day <= week.to)
      .map((day) => blockSpan(absence, day)),
  );
  return showingAbsences(
    hoursSpan([...schedules.map(scheduleSpan), ...blockSpans]),
    absenceSpans,
  );
}

export type TimeOff = {
  starts_at: string;
  ends_at: string;
  reason: string | null;
};

export function scheduleWarnings({
  professionalName,
  start,
  end,
  schedules,
  timeOff,
}: {
  professionalName: string;
  start: string;
  end: string;
  schedules: ScheduleBlock[];
  timeOff: TimeOff[];
}): string[] {
  const warnings: string[] = [];
  const startWall = madridDateTime(start);
  const endWall = madridDateTime(end);
  const weekday = weekdayOf(startWall.date);
  const fitsSchedule =
    startWall.date === endWall.date &&
    schedules.some(
      (schedule) =>
        schedule.weekday === weekday &&
        startWall.time >= schedule.starts_at.slice(0, 5) &&
        endWall.time <= schedule.ends_at.slice(0, 5),
    );
  if (!fitsSchedule)
    warnings.push(`Queda fuera del horario de ${professionalName}.`);

  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  const overlappingTimeOff = timeOff.find(
    (entry) =>
      startMs < new Date(entry.ends_at).getTime() &&
      endMs > new Date(entry.starts_at).getTime(),
  );
  if (overlappingTimeOff)
    warnings.push(
      overlappingTimeOff.reason
        ? `${professionalName} tiene una ausencia ese día (${overlappingTimeOff.reason}).`
        : `${professionalName} tiene una ausencia ese día.`,
    );

  return warnings;
}

export type AppointmentInput = {
  professional_id: string;
  patient_id: string;
  service_id: string;
  starts_at: string;
  ends_at: string;
  notes: string;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function parseAppointmentForm(
  formData: FormData,
): { ok: true; appointment: AppointmentInput } | { error: string } {
  const patientId = text(formData, "patient_id");
  const serviceId = text(formData, "service_id");
  const professionalId = text(formData, "professional_id");
  const date = text(formData, "date");
  const time = text(formData, "time");
  const durationRaw = text(formData, "duration_minutes");
  const notes = text(formData, "notes");

  if (!patientId) return { error: "Elige un paciente." };
  if (!serviceId) return { error: "Elige un servicio." };
  if (!professionalId) return { error: "Elige un profesional." };
  if (!date || !time) return { error: "Indica fecha y hora." };
  if (!isValidDate(date) || !isValidTime(time))
    return { error: "Indica fecha y hora." };
  if (notes.length > 2000)
    return { error: "Las notas no pueden superar los 2000 caracteres." };

  const duration = Number(durationRaw);
  if (
    !Number.isFinite(duration) ||
    duration < 5 ||
    duration > 480 ||
    duration % 5 !== 0
  )
    return {
      error: "La duración debe estar entre 5 y 480 minutos, en pasos de 5.",
    };

  const startsAt = madridInstant(date, time);
  const endInstant = new Date(new Date(startsAt).getTime() + duration * 60_000);
  const endWall = madridDateTime(endInstant);
  const endsAt = madridInstant(endWall.date, endWall.time);

  if (
    endWall.date !== date &&
    !(endWall.date === addDays(date, 1) && endWall.time === "00:00")
  )
    return { error: "La cita tiene que empezar y terminar el mismo día." };

  return {
    ok: true,
    appointment: {
      professional_id: professionalId,
      patient_id: patientId,
      service_id: serviceId,
      starts_at: startsAt,
      ends_at: endsAt,
      notes,
    },
  };
}

export type AppointmentState = {
  status: "scheduled" | "cancelled" | "no_show";
  starts_at: string;
};

export function canMarkNoShow(
  appointment: AppointmentState,
  now: Date,
): boolean {
  return (
    appointment.status === "scheduled" &&
    new Date(appointment.starts_at).getTime() <= now.getTime()
  );
}

export function pastTimeWarnings(start: string, now: Date): string[] {
  return new Date(start).getTime() <= now.getTime()
    ? ["Esa hora ya ha pasado."]
    : [];
}

export function canMove(appointment: AppointmentState, now: Date): boolean {
  return (
    appointment.status === "scheduled" &&
    new Date(appointment.starts_at).getTime() > now.getTime()
  );
}

export type DbError = { code?: string; message?: string };

const MESSAGE_BY_CODE: Record<string, string> = {
  appointment_not_started:
    "Solo se puede marcar como no presentada cuando la cita ya ha empezado.",
  appointment_cancelled_final:
    "Una cita cancelada no se puede cambiar de fecha u hora; crea una nueva.",
  appointment_in_past:
    "No se puede cambiar la fecha u hora de una cita que ya ha pasado.",
  appointment_invoiced:
    "Para cambiar de profesional una cita cobrada, anula antes el cobro.",
  appointment_immutable_fields: "Esos datos de la cita no se pueden cambiar.",
  patient_not_bookable: "Esa ficha no es de paciente o está archivada.",
  service_inactive: "Ese servicio ya no está activo.",
  professional_inactive: "Ese profesional no está activo.",
  service_not_for_professional:
    "Ese servicio no es de la especialidad del profesional.",
  cancelled_by_required: "Indica quién cancela la cita.",
  appointment_invalid_transition:
    "No se puede cancelar una cita marcada como no presentada.",
  appointment_crosses_midnight:
    "La cita tiene que empezar y terminar el mismo día.",
};

export function isPatientOverlap(error: DbError): boolean {
  return (
    error.code === "23P01" &&
    Boolean(error.message?.includes("appointments_patient_no_overlap"))
  );
}

export function appointmentError(error: DbError): string {
  if (isPatientOverlap(error))
    return "Este paciente ya tiene una cita a esa hora.";
  if (error.code === "23P01") return "Ya hay una cita en esa franja.";
  if (error.code === "42501")
    return "No tienes permiso para dar citas a otro profesional.";
  if (error.code === "23514" && error.message) {
    const mapped = MESSAGE_BY_CODE[error.message];
    if (mapped) return mapped;
  }
  return "No se ha podido guardar.";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function monthNameOf(date: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "UTC",
    month: "long",
  }).format(new Date(`${date}T00:00:00Z`));
}

export function weekTitle(start: string, end: string): string {
  const startYear = start.slice(0, 4);
  const startMonth = start.slice(5, 7);
  const startDay = Number(start.slice(8, 10));
  const endYear = end.slice(0, 4);
  const endMonth = end.slice(5, 7);
  const endDay = Number(end.slice(8, 10));
  const endMonthName = monthNameOf(end);

  if (startYear === endYear && startMonth === endMonth) {
    return `Semana del ${startDay} al ${endDay} de ${endMonthName}`;
  }
  const startMonthName = monthNameOf(start);
  if (startYear === endYear) {
    return `Semana del ${startDay} de ${startMonthName} al ${endDay} de ${endMonthName}`;
  }
  return `Semana del ${startDay} de ${startMonthName} de ${startYear} al ${endDay} de ${endMonthName} de ${endYear}`;
}

export type SpecialtyTone = "sage" | "bark" | "pebble" | "neutral";

export function specialtyTone(slug: string): SpecialtyTone {
  if (slug === "logopedia") return "sage";
  if (slug === "psicologia") return "bark";
  if (slug === "fisioterapia") return "pebble";
  return "neutral";
}

export function adjacentAppointments(
  appointments: { id: string; startsAt: string; professionalId: string }[],
  currentId: string,
  columnOrder: string[],
): { previousId: string | null; nextId: string | null } {
  const column = (professionalId: string) => {
    const index = columnOrder.indexOf(professionalId);
    return index === -1 ? columnOrder.length : index;
  };
  const ordered = [...appointments].sort(
    (a, b) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
      column(a.professionalId) - column(b.professionalId),
  );
  const index = ordered.findIndex(
    (appointment) => appointment.id === currentId,
  );
  if (index === -1) return { previousId: null, nextId: null };
  return {
    previousId: ordered[index - 1]?.id ?? null,
    nextId: ordered[index + 1]?.id ?? null,
  };
}

export function professionalOptions({
  directory,
  specialtyId,
  current,
  pendingIds = [],
}: {
  directory: { id: string; full_name: string; specialty_id: string | null }[];
  specialtyId: string | null;
  current: { id: string; name: string };
  pendingIds?: string[];
}): { value: string; label: string; disabled?: boolean }[] {
  const active = directory
    .filter((member) => member.specialty_id === specialtyId)
    .filter(
      (member) => member.id === current.id || !pendingIds.includes(member.id),
    )
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "es"))
    .map((member) => ({ value: member.id, label: member.full_name }));
  if (directory.some((member) => member.id === current.id)) return active;
  return [
    { value: current.id, label: `${current.name} (inactiva)`, disabled: true },
    ...active,
  ];
}

export function newAppointmentDrawerHref(params: {
  date?: string;
  time?: string;
  professional?: string;
  patient?: string;
}): string {
  const search = new URLSearchParams();
  if (params.date) search.set("date", params.date);
  search.set("new", "1");
  if (params.time) search.set("time", params.time);
  if (params.professional) search.set("professional", params.professional);
  if (params.patient) search.set("patient", params.patient);
  return `/?${search.toString()}`;
}

export function appointmentFormInitials(
  params: { date?: string; time?: string; professional?: string },
  professionals: { id: string }[],
  today: string,
): {
  initialDate: string;
  initialTime: string;
  initialProfessionalId: string | null;
} {
  return {
    initialDate: params.date && isValidDate(params.date) ? params.date : today,
    initialTime: params.time && isValidTime(params.time) ? params.time : "",
    initialProfessionalId:
      params.professional &&
      isUuid(params.professional) &&
      professionals.some(
        (professional) => professional.id === params.professional,
      )
        ? params.professional
        : null,
  };
}
