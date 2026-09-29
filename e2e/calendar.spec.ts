import { execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import {
  addDays,
  madridInstant,
  todayInMadrid,
} from "@clinicalumia/api/madrid-time";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { signIn } from "./auth";

const DASHBOARD = "http://localhost:3001";

const env = execSync("cd ../packages/db && supabase status -o env").toString();
const serviceKey = env.match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const createdAppointmentIds: string[] = [];
const createdPersonIds: string[] = [];
const createdUserIds: string[] = [];
const createdServiceIds: string[] = [];
const createdSpecialtyIds: string[] = [];

function unique() {
  return `${Date.now()}-${randomInt(1e9)}`;
}

function unfolded(ics: string) {
  return ics.replace(/\r\n /g, "");
}

test.afterEach(async () => {
  for (const [table, ids] of [
    ["appointments", createdAppointmentIds],
    ["people", createdPersonIds],
  ] as const) {
    const pending = ids.splice(0);
    if (pending.length === 0) continue;
    const { error } = await admin.from(table).delete().in("id", pending);
    expect(error).toBeNull();
  }
  for (const id of createdUserIds.splice(0)) {
    const { error } = await admin.auth.admin.deleteUser(id);
    expect(error).toBeNull();
  }
  for (const [table, ids] of [
    ["services", createdServiceIds],
    ["specialties", createdSpecialtyIds],
  ] as const) {
    const pending = ids.splice(0);
    if (pending.length === 0) continue;
    const { error } = await admin.from(table).delete().in("id", pending);
    expect(error).toBeNull();
  }
});

async function professionalWithAppointment() {
  const suffix = unique();
  const { data: specialty, error } = await admin
    .from("specialties")
    .insert({
      name: `Calendario e2e ${suffix}`,
      slug: `calendario-e2e-${suffix}`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdSpecialtyIds.push(specialty!.id);

  const serviceName = `Sesión calendario ${suffix}`;
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

  const email = `calendario-profesional-${suffix}@test.local`;
  const password = "lumia-segura-2026";
  const fullName = `Nora Calendario ${suffix}`;
  const { data: user, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  expect(userError).toBeNull();
  const professionalId = user.user!.id;
  createdUserIds.push(professionalId);
  const { error: profileError } = await admin.from("profiles").insert({
    id: professionalId,
    email,
    full_name: fullName,
    role: "employee",
    specialty_id: specialty!.id,
    is_active: true,
  });
  expect(profileError).toBeNull();

  const { data: patient, error: patientError } = await admin
    .from("people")
    .insert({
      first_name: "Marta",
      last_name: `Calendario ${suffix}`,
      birth_date: "1988-03-14",
      is_patient: true,
    })
    .select("id, first_name, last_name")
    .single();
  expect(patientError).toBeNull();
  createdPersonIds.push(patient!.id);

  const notes = `Nota clínica privada ${suffix}`;
  const day = addDays(todayInMadrid(), 10);
  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .insert({
      professional_id: professionalId,
      patient_id: patient!.id,
      service_id: service!.id,
      starts_at: madridInstant(day, "10:00"),
      ends_at: madridInstant(day, "10:45"),
      notes,
    })
    .select("id")
    .single();
  expect(appointmentError).toBeNull();
  createdAppointmentIds.push(appointment!.id);

  return {
    email,
    password,
    fullName,
    notes,
    appointmentId: appointment!.id as string,
    summary: `${patient!.first_name} ${patient!.last_name} · ${serviceName}`,
  };
}

test("una profesional genera su enlace de calendario, que muestra sus citas solo con paciente y servicio, y al cambiarlo el antiguo deja de funcionar", async ({
  page,
  playwright,
}) => {
  const professional = await professionalWithAppointment();
  await signIn(page, DASHBOARD, professional.email, professional.password);

  await page.getByRole("link", { name: "Mi calendario" }).click();
  await page.getByTestId("calendar-generate").click();
  const link = page.getByTestId("calendar-url");
  await expect(link).toHaveText(
    new RegExp(`^${DASHBOARD}/calendario/[A-Za-z0-9_-]{43}\\.ics$`),
  );
  const oldUrl = (await link.textContent())!;

  const calendarApp = await playwright.request.newContext();
  const response = await calendarApp.get(oldUrl);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe(
    "text/calendar; charset=utf-8",
  );
  expect(response.headers()["cache-control"]).toBe("private, max-age=300");
  const ics = unfolded(await response.text());
  expect(ics).toContain(`X-WR-CALNAME:LUMIA · ${professional.fullName}`);
  expect(ics).toContain(`UID:${professional.appointmentId}@clinicalumia.es`);
  expect(ics).toContain(`SUMMARY:${professional.summary}`);
  expect(ics).not.toContain(professional.notes);

  await page.getByTestId("calendar-regenerate").click();
  await page.getByTestId("calendar-regenerate-confirm").click();
  await expect(link).not.toHaveText(oldUrl);
  const newUrl = (await link.textContent())!;

  expect((await calendarApp.get(oldUrl)).status()).toBe(404);
  const renewed = await calendarApp.get(newUrl);
  expect(renewed.status()).toBe(200);
  expect(unfolded(await renewed.text())).toContain(
    `SUMMARY:${professional.summary}`,
  );
  await calendarApp.dispose();
});

test("un enlace de calendario inventado no existe, sin pedir iniciar sesión", async ({
  playwright,
}) => {
  const calendarApp = await playwright.request.newContext();

  const response = await calendarApp.get(
    `${DASHBOARD}/calendario/estoNoEsUnTokenDeVerdadEstoNoEsUnTokenDeVer.ics`,
    { maxRedirects: 0 },
  );

  expect(response.status()).toBe(404);
  await calendarApp.dispose();
});
