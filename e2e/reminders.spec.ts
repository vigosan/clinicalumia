import { execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import {
  addDays,
  madridInstant,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { removePatients } from "./users";

const WEB = "http://localhost:3000";
const API = "http://127.0.0.1:54321";
const MAILPIT = "http://127.0.0.1:54324/api/v1";
const CRON = `${WEB}/api/cron/recordatorios`;
const SUBJECT = "Recordatorio de tu cita";

const env = execSync("cd ../packages/db && supabase status -o env").toString();
const serviceKey = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient(API, serviceKey ?? "");

const usedEmails: string[] = [];
const createdUserIds: string[] = [];
const createdServiceIds: string[] = [];
const createdSpecialtyIds: string[] = [];

function unique() {
  return `${Date.now()}-${randomInt(1e9)}`;
}

function uniqueEmail(prefix: string) {
  const email = `${prefix}-${unique()}@test.local`;
  usedEmails.push(email);
  return email;
}

test.afterEach(async () => {
  await removePatients(admin, usedEmails.splice(0));
  for (const id of createdUserIds.splice(0)) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }
  const serviceIds = createdServiceIds.splice(0);
  if (serviceIds.length > 0) {
    const { error } = await admin
      .from("services")
      .delete()
      .in("id", serviceIds);
    if (error) throw error;
  }
  const specialtyIds = createdSpecialtyIds.splice(0);
  if (specialtyIds.length > 0) {
    const { error } = await admin
      .from("specialties")
      .delete()
      .in("id", specialtyIds);
    if (error) throw error;
  }
});

async function clinic() {
  const suffix = unique();
  const { data: specialty, error } = await admin
    .from("specialties")
    .insert({
      name: `Recordatorios e2e ${suffix}`,
      slug: `recordatorios-e2e-${suffix}`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdSpecialtyIds.push(specialty!.id);

  const serviceName = `Sesión recordatorio ${suffix}`;
  const { data: service, error: serviceError } = await admin
    .from("services")
    .insert({
      specialty_id: specialty!.id,
      name: serviceName,
      duration_minutes: 45,
      price_cents: 4500,
    })
    .select("id")
    .single();
  expect(serviceError).toBeNull();
  createdServiceIds.push(service!.id);

  const professionalEmail = `recordatorio-profesional-${suffix}@test.local`;
  const { data: user, error: userError } = await admin.auth.admin.createUser({
    email: professionalEmail,
    email_confirm: true,
  });
  expect(userError).toBeNull();
  const professionalId = user.user!.id;
  createdUserIds.push(professionalId);
  const { error: profileError } = await admin.from("profiles").insert({
    id: professionalId,
    email: professionalEmail,
    full_name: `Ana Recordatorio ${suffix}`,
    role: "employee",
    specialty_id: specialty!.id,
    is_active: true,
  });
  expect(profileError).toBeNull();

  return { serviceId: service!.id as string, professionalId };
}

async function person(values: {
  first_name: string;
  birth_date: string;
  email?: string;
}) {
  const { data, error } = await admin
    .from("people")
    .insert({
      last_name: `Recordatorio ${unique()}`,
      is_patient: true,
      ...values,
    })
    .select("id, first_name, last_name")
    .single();
  expect(error).toBeNull();
  return data!;
}

async function reminderEmailsTo(email: string) {
  const query = `to:"${email}" subject:"${SUBJECT}"`;
  const { messages } = await (
    await fetch(`${MAILPIT}/search?query=${encodeURIComponent(query)}`)
  ).json();
  return Promise.all(
    messages.map(
      async (message: { ID: string }) =>
        (await fetch(`${MAILPIT}/message/${message.ID}`)).json() as Promise<{
          HTML: string;
          Attachments: { FileName: string }[];
        }>,
    ),
  );
}

function runCron() {
  return fetch(CRON, {
    headers: { authorization: "Bearer lumia-cron-local" },
  });
}

test("the daily reminder emails tomorrow's patients once, to the guardian when the patient is a minor without email, and never for a cancelled appointment", async () => {
  const place = await clinic();
  const adultEmail = uniqueEmail("recordatorio-adulto");
  const guardianEmail = uniqueEmail("recordatorio-tutora");
  const adult = await person({
    first_name: "Marta",
    birth_date: "1988-03-14",
    email: adultEmail,
  });
  const guardian = await person({
    first_name: "Rosa",
    birth_date: "1985-06-02",
    email: guardianEmail,
  });
  const minor = await person({ first_name: "Leo", birth_date: "2018-05-10" });
  const { error: guardianshipError } = await admin
    .from("guardianships")
    .insert({
      minor_id: minor.id,
      guardian_id: guardian.id,
      relationship: "madre",
      is_primary: true,
    });
  expect(guardianshipError).toBeNull();

  const tomorrow = addDays(todayInMadrid(), 1);
  const appointment = (patientId: string, time: string, end: string) => ({
    professional_id: place.professionalId,
    patient_id: patientId,
    service_id: place.serviceId,
    starts_at: madridInstant(tomorrow, time),
    ends_at: madridInstant(tomorrow, end),
  });
  const { data: appointments, error: appointmentsError } = await admin
    .from("appointments")
    .insert([
      appointment(adult.id, "10:00", "10:45"),
      appointment(minor.id, "11:00", "11:45"),
      appointment(adult.id, "12:00", "12:45"),
    ])
    .select("id, starts_at");
  expect(appointmentsError).toBeNull();
  const [adultAppointment, minorAppointment, cancelledAppointment] = [
    "10:00",
    "11:00",
    "12:00",
  ].map(
    (time) =>
      appointments!.find(
        (row) =>
          Date.parse(row.starts_at) ===
          Date.parse(madridInstant(tomorrow, time)),
      )!,
  );
  const { error: cancelError } = await admin
    .from("appointments")
    .update({
      status: "cancelled",
      cancelled_by: "clinic",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", cancelledAppointment.id);
  expect(cancelError).toBeNull();

  expect((await fetch(CRON)).status).toBe(401);

  const first = await runCron();
  expect(first.status).toBe(200);

  const toAdult = await reminderEmailsTo(adultEmail);
  expect(toAdult).toHaveLength(1);
  expect(toAdult[0].HTML).toContain(
    `Te recordamos la cita de ${adult.first_name} ${adult.last_name} mañana`,
  );
  expect(toAdult[0].HTML).toContain("a las 10:00");
  expect(toAdult[0].HTML).not.toContain("a las 12:00");
  expect(toAdult[0].Attachments.map((file) => file.FileName)).toEqual([
    "cita.ics",
  ]);

  const toGuardian = await reminderEmailsTo(guardianEmail);
  expect(toGuardian).toHaveLength(1);
  expect(toGuardian[0].HTML).toContain(
    `Te recordamos la cita de ${minor.first_name} ${minor.last_name} mañana`,
  );

  const { data: logged, error: loggedError } = await admin
    .from("appointment_reminders")
    .select("appointment_id, channel, recipient, status, sent_at, error")
    .in("appointment_id", [
      adultAppointment.id,
      minorAppointment.id,
      cancelledAppointment.id,
    ]);
  expect(loggedError).toBeNull();
  expect(
    logged!
      .map(({ appointment_id, channel, recipient, status, error }) => ({
        appointment_id,
        channel,
        recipient,
        status,
        error,
      }))
      .sort((a, b) => a.recipient.localeCompare(b.recipient)),
  ).toEqual(
    [
      {
        appointment_id: adultAppointment.id,
        channel: "email",
        recipient: adultEmail,
        status: "sent",
        error: "",
      },
      {
        appointment_id: minorAppointment.id,
        channel: "email",
        recipient: guardianEmail,
        status: "sent",
        error: "",
      },
    ].sort((a, b) => a.recipient.localeCompare(b.recipient)),
  );
  expect(logged!.every((row) => row.sent_at !== null)).toBe(true);

  const second = await runCron();
  expect(second.status).toBe(200);
  expect(await reminderEmailsTo(adultEmail)).toHaveLength(1);
  expect(await reminderEmailsTo(guardianEmail)).toHaveLength(1);
  const { count, error: countError } = await admin
    .from("appointment_reminders")
    .select("id", { count: "exact", head: true })
    .in("appointment_id", [
      adultAppointment.id,
      minorAppointment.id,
      cancelledAppointment.id,
    ]);
  expect(countError).toBeNull();
  expect(count).toBe(2);
});

test("an appointment moved after its reminder is reminded of the new time once, however many times the cron runs that day", async () => {
  const place = await clinic();
  const email = uniqueEmail("recordatorio-movida");
  const patient = await person({
    first_name: "Nuria",
    birth_date: "1990-01-20",
    email,
  });
  const tomorrow = addDays(todayInMadrid(), 1);
  const { data: appointment, error } = await admin
    .from("appointments")
    .insert({
      professional_id: place.professionalId,
      patient_id: patient.id,
      service_id: place.serviceId,
      starts_at: madridInstant(tomorrow, "10:00"),
      ends_at: madridInstant(tomorrow, "10:45"),
    })
    .select("id")
    .single();
  expect(error).toBeNull();

  expect((await runCron()).status).toBe(200);
  expect(await reminderEmailsTo(email)).toHaveLength(1);

  const { error: moveError } = await admin
    .from("appointments")
    .update({
      starts_at: madridInstant(tomorrow, "17:00"),
      ends_at: madridInstant(tomorrow, "17:45"),
    })
    .eq("id", appointment!.id);
  expect(moveError).toBeNull();

  expect((await runCron()).status).toBe(200);
  expect((await runCron()).status).toBe(200);

  const reminders = await reminderEmailsTo(email);
  expect(reminders).toHaveLength(2);
  expect(
    reminders.filter((message) => message.HTML.includes("a las 17:00")),
  ).toHaveLength(1);
});
