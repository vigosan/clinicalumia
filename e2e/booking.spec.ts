import { execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { addDays, todayInMadrid } from "@clinicalumia/api/madrid-time";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const WEB = "http://localhost:3000";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const createdSpecialtyIds: string[] = [];
const createdServiceIds: string[] = [];
const createdUserIds: string[] = [];

function unique() {
  return `${Date.now()}-${randomInt(1e9)}`;
}

async function createSpecialty() {
  const suffix = unique();
  const name = `Especialidad e2e ${suffix}`;
  const { data, error } = await admin
    .from("specialties")
    .insert({ name, slug: `especialidad-e2e-${suffix}` })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdSpecialtyIds.push(data!.id);
  return { id: data!.id as string, name };
}

async function createService(
  specialtyId: string,
  payment: { booking_payment: "fixed"; booking_payment_value: number } | null,
) {
  const name = `Sesión e2e ${unique()}`;
  const { data, error } = await admin
    .from("services")
    .insert({
      specialty_id: specialtyId,
      name,
      duration_minutes: 45,
      price_cents: 4500,
      bookable_online: true,
      ...payment,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  createdServiceIds.push(data!.id);
  return { id: data!.id as string, name };
}

async function createProfessional(
  specialtyId: string,
  fullName: string,
  withSchedule: boolean,
) {
  const email = `reserva-profesional-${unique()}@test.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
  });
  expect(error).toBeNull();
  const id = data.user!.id;
  createdUserIds.push(id);
  const { error: profileError } = await admin.from("profiles").insert({
    id,
    email,
    full_name: fullName,
    role: "employee",
    specialty_id: specialtyId,
    is_active: true,
  });
  expect(profileError).toBeNull();
  if (withSchedule) {
    const { error: scheduleError } = await admin
      .from("employee_schedules")
      .insert(
        [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
          profile_id: id,
          weekday,
          starts_at: "09:00",
          ends_at: "13:00",
        })),
      );
    expect(scheduleError).toBeNull();
  }
  return id;
}

async function clinicWithTwoProfessionals() {
  const specialty = await createSpecialty();
  const service = await createService(specialty.id, null);
  const suffix = unique();
  const withHours = `Ana Horario ${suffix}`;
  const withoutHours = `Bruno Sinhorario ${suffix}`;
  const withHoursId = await createProfessional(specialty.id, withHours, true);
  await createProfessional(specialty.id, withoutHours, false);
  return { specialty, service, withHours, withHoursId, withoutHours };
}

async function openService(
  page: Page,
  specialtyName: string,
  serviceName: string,
) {
  await page.goto(`${WEB}/reservar`);
  await page
    .getByTestId("booking-specialty")
    .filter({ hasText: specialtyName })
    .click();
  await page
    .getByTestId("booking-service")
    .filter({ hasText: serviceName })
    .click();
}

test.afterEach(async () => {
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

test("without a session, picking specialty, service, the first free slot and a time sends the patient to identify themselves and keeps the choice", async ({
  page,
}) => {
  const { specialty, service } = await clinicWithTwoProfessionals();

  await openService(page, specialty.name, service.name);
  await page
    .getByTestId("booking-professional")
    .filter({ hasText: "El primer hueco libre" })
    .click();

  const slot = page.getByTestId("booking-slot").first();
  await expect(slot).toBeVisible();
  await expect(slot).toHaveAttribute(
    "aria-label",
    /^(Hoy|Mañana|\S+ \d+ de \S+) a las \d{2}:\d{2}$/,
  );
  await slot.click();

  await expect(page).toHaveURL(/\/acceder\?next=/);
  const next = new URL(page.url()).searchParams.get("next") ?? "";
  const chosen = new URL(next, WEB);
  expect(chosen.pathname).toBe("/reservar");
  expect(chosen.searchParams.get("servicio")).toBe(service.id);
  expect(chosen.searchParams.get("profesional")).toBe("cualquiera");
  expect(Date.parse(chosen.searchParams.get("inicio") ?? "")).toBeGreaterThan(
    Date.now(),
  );
  await expect(page.getByTestId("access-email")).toBeVisible();
});

test("a service that needs a deposit cannot be booked online and offers the clinic phone instead", async ({
  page,
}) => {
  const specialty = await createSpecialty();
  const service = await createService(specialty.id, {
    booking_payment: "fixed",
    booking_payment_value: 1000,
  });

  await page.goto(`${WEB}/reservar?especialidad=${specialty.id}`);

  const phoneOnly = page
    .getByTestId("booking-phone-only")
    .filter({ hasText: service.name });
  await expect(phoneOnly).toContainText("Reserva por teléfono");
  await expect(phoneOnly.getByRole("link")).toHaveAttribute(
    "href",
    "tel:+34614552808",
  );
  await expect(
    page.getByTestId("booking-service").filter({ hasText: service.name }),
  ).toHaveCount(0);
});

test("a professional without working hours offers no slots and points to the phone, while one with hours pages to the next days", async ({
  page,
}) => {
  const { specialty, service, withHours, withHoursId, withoutHours } =
    await clinicWithTwoProfessionals();

  await openService(page, specialty.name, service.name);
  await page
    .getByTestId("booking-professional")
    .filter({ hasText: withoutHours })
    .click();

  await expect(page.getByTestId("booking-no-slots")).toContainText(
    "No hay huecos estos días",
  );
  await expect(
    page.getByTestId("booking-no-slots").getByRole("link"),
  ).toHaveAttribute("href", "tel:+34614552808");
  await expect(page.getByTestId("booking-slot")).toHaveCount(0);

  await openService(page, specialty.name, service.name);
  await page
    .getByTestId("booking-professional")
    .filter({ hasText: withHours })
    .click();
  await expect(page.getByTestId("booking-slot").first()).toBeVisible();

  await page.getByTestId("booking-next-days").click();

  const windowStart = addDays(todayInMadrid(), 14);
  await expect(page).toHaveURL(new RegExp(`fecha=${windowStart}`));
  const slot = page.getByTestId("booking-slot").first();
  await expect(slot).toBeVisible();
  await expect(slot).toHaveAttribute("data-date", windowStart);
  expect(new URL(page.url()).searchParams.get("profesional")).toBe(withHoursId);
});

test("the booking button in the web header starts the online booking instead of the contact form", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(WEB);

  await page.getByRole("link", { name: "Coger cita" }).click();

  await expect(page).toHaveURL(`${WEB}/reservar`);
  await expect(page.getByTestId("booking-specialty").first()).toBeVisible();
});

function slotStepUrl(
  specialtyId: string,
  serviceId: string,
  professionalId: string,
  extra: string,
) {
  return `${WEB}/reservar?especialidad=${specialtyId}&servicio=${serviceId}&profesional=${professionalId}${extra}`;
}

test("a far-future or tampered date in the URL shows the slots from today instead of breaking the page", async ({
  page,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();

  await page.goto(
    slotStepUrl(specialty.id, service.id, withHoursId, "&fecha=9999-12-25"),
  );

  const slot = page.getByTestId("booking-slot").first();
  await expect(slot).toBeVisible();
  const date = (await slot.getAttribute("data-date")) ?? "";
  expect(date < addDays(todayInMadrid(), 14)).toBe(true);
});

test("the last window before the booking horizon offers no further days, because nothing later can be booked", async ({
  page,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();
  const { data, error } = await admin
    .from("clinic_settings")
    .select("booking_horizon_days")
    .single();
  expect(error).toBeNull();
  const fecha = addDays(todayInMadrid(), data!.booking_horizon_days - 4);

  await page.goto(
    slotStepUrl(specialty.id, service.id, withHoursId, `&fecha=${fecha}`),
  );

  await expect(page.getByTestId("booking-slot").first()).toBeVisible();
  await expect(page.getByTestId("booking-next-days")).toHaveCount(0);
});

test("an unknown service in the URL goes back to the services of the chosen specialty", async ({
  page,
}) => {
  const { specialty, service } = await clinicWithTwoProfessionals();

  await page.goto(
    `${WEB}/reservar?especialidad=${specialty.id}&servicio=99999999-9999-9999-9999-999999999999`,
  );

  await expect(
    page.getByTestId("booking-service").filter({ hasText: service.name }),
  ).toBeVisible();
});

test("a chosen time that has already passed goes back to the slots instead of showing it as the appointment", async ({
  page,
}) => {
  const { specialty, service, withHoursId } =
    await clinicWithTwoProfessionals();

  await page.goto(
    slotStepUrl(
      specialty.id,
      service.id,
      withHoursId,
      `&inicio=${encodeURIComponent(new Date(Date.now() - 86_400_000).toISOString())}`,
    ),
  );

  await expect(page.getByTestId("booking-slot").first()).toBeVisible();
  await expect(page.getByTestId("booking-chosen")).toHaveCount(0);
});
