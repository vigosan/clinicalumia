import { execSync } from "node:child_process";
import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const WEB = "http://localhost:3000";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];

const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

const run = `${Date.now()}-${randomInt(1e9)}`;
const seededEmails = Array.from(
  { length: 80 },
  (_, index) => `cupo-${run}-${index}@test.local`,
);
const email = `cupo-${run}-paciente@test.local`;

test.afterEach(async () => {
  const { error } = await admin
    .from("access_requests")
    .delete()
    .in("email", [...seededEmails, email]);
  expect(error).toBeNull();
});

test("once 80 access codes went out in the last hour, the web stops sending more and gives the clinic phone, so Supabase's email quota is never spent", async ({
  page,
}) => {
  const { error } = await admin.from("access_requests").insert(
    seededEmails.map((seeded) => ({
      email: seeded,
      ip_hash: `cupo-${run}`,
      kind: "code_sent",
    })),
  );
  expect(error).toBeNull();
  await page.setExtraHTTPHeaders({
    "x-forwarded-for": `198.18.${randomInt(256)}.${randomInt(256)}`,
  });

  await page.goto(`${WEB}/acceder?next=%2Freservar`);
  await page.getByTestId("access-email").fill(email);
  await page.getByTestId("access-submit").click();

  await expect(page.getByTestId("access-error")).toHaveText(
    "Ahora mismo hay muchas peticiones. Inténtalo en unos minutos o llama al 614 552 808.",
  );
  await expect(page).toHaveURL(`${WEB}/acceder?next=%2Freservar`);
});
