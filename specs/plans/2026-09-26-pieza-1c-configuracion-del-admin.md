# Pieza 1c — Configuración del admin · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la propietaria configure desde el admin todo lo que necesitan las piezas siguientes (agenda, reservas, cobros y facturación): servicios con duración, precio, IVA y pago al reservar; horarios y ausencias de cada empleado; datos fiscales y de facturación de la clínica con su logo; política de cancelación; y el equipo completo con nº de colegiado.

**Architecture:** Tres migraciones nuevas (servicios; horarios y ausencias; datos de la clínica con bucket `branding`), con reglas de acceso "leer: personal activo, escribir: propietaria" probadas con pgTAP. La validación de cada formulario es una función pura en `apps/admin/lib/` con tests de Vitest; las acciones del servidor la usan y comprueban `requireOwner`. Las pantallas usan `@clinicalumia/ui`. El horario semanal se guarda de una vez con una función SQL (`set_employee_schedule`) para que sea atómico.

**Tech Stack:** Supabase (Postgres, RLS, Storage, pgTAP) · Next.js 16 · React 19 · `@clinicalumia/ui` · Vitest · Playwright.

**Spec:** `specs/2026-09-25-plataforma-lumia-v1-design.md` (secciones 4.2 puntos 3–8 y 4.5). Bocetos: `specs/bocetos/*.png`.

**Planes anteriores:** 1a (entorno, migraciones, acceso) y 1b (sistema de diseño), ya en `main`. Siguiente: 1d (publicación en Vercel, producción y verificación en dos pasos).

## Global Constraints

- Todo cambio de base de datos es una migración en `packages/db/supabase/migrations`; tras cada migración, `make db.types` y `make db.types.check` en verde.
- Reglas de acceso de las tablas nuevas: `select` para personal activo (`public.is_active_staff()`), `insert/update/delete` solo para `public.is_owner()`. Nada se concede por "haber iniciado sesión" sin más.
- Importes en céntimos (`integer`), nunca en coma flotante. El usuario escribe euros con coma o punto.
- IVA por servicio: `exempt` (sanitario, art. 20.Uno.3º LIVA) o `standard_21`.
- Pago al reservar: `none`, `fixed` (céntimos, no más que el precio), `percent` (1–100) o `full`.
- Plazo de cancelación en horas (0–720): general en los datos de la clínica, sobrescribible por servicio.
- Toda acción del admin empieza con `requireOwner` y devuelve `ActionResult` (`{ ok: true } | { error: string }`), sin tragarse errores.
- UI solo con componentes de `@clinicalumia/ui`; contraste y estilos del sistema de diseño; nada importante se corta a 390px.
- El seed de desarrollo (`packages/db/supabase/seed.sql`) se amplía con datos realistas de cada tabla nueva; los e2e borran lo que crean y restauran lo que modifican.
- Sin comentarios en el código. Tests: `data-testid` > rol > etiqueta; nunca clases.
- Commits pequeños, título descriptivo en español, sin cuerpo ni prefijos; nunca `--no-verify`. `make lint`, `make typecheck`, `make test`, `make test.db` en verde antes de cada commit; `make test.e2e` en las tareas que tocan pantallas.

## Review Focus

1. **Precio o señal escritos a la española** (`45,50`, `1.234,00`, `45 €`): deben entenderse bien o dar un error claro, nunca guardarse mal. Tests en la Tarea 2.
2. **Dos tramos de horario que se solapan** el mismo día: error claro en el formulario y, si llegaran a la base de datos, rechazo por la restricción. Tests en las Tareas 4 y 5.
3. **Guardar el horario a medias** si falla a mitad: la función SQL lo hace en una transacción. Test en la Tarea 4.
4. **NIF/NIE/CIF mal escrito** (minúsculas, guiones, espacios, letra de control incorrecta): se normaliza o se rechaza con un mensaje claro. Tests en la Tarea 8.
5. **Logo demasiado grande o de otro tipo**: rechazo claro, sin dejar un logo roto ni archivos huérfanos. Test en la Tarea 9.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/db/supabase/migrations/20260926090000_servicios.sql` | Tabla `services`, enums, reglas (crear). |
| `packages/db/supabase/migrations/20260926100000_horarios_y_ausencias.sql` | `employee_schedules`, `employee_time_off`, `set_employee_schedule` (crear). |
| `packages/db/supabase/migrations/20260926110000_datos_de_la_clinica.sql` | `clinic_settings`, bucket `branding` y sus reglas (crear). |
| `packages/db/supabase/tests/services.test.sql`, `schedules.test.sql`, `clinic_settings.test.sql` | pgTAP (crear). |
| `packages/db/supabase/seed.sql`, `tests/seed.test.sql` | Datos de desarrollo ampliados (modificar). |
| `packages/db/types.ts` | Regenerado. |
| `apps/admin/lib/money.ts`, `service-form.ts`, `schedule.ts`, `tax-id.ts`, `clinic-settings.ts` (+ tests) | Validación pura (crear). |
| `apps/admin/app/(admin)/services/**` | Servicios (crear). |
| `apps/admin/app/(admin)/schedules/**` | Horarios y ausencias (crear). |
| `apps/admin/app/(admin)/clinic/**` | Datos de la clínica, logo y cancelación (crear). |
| `apps/admin/app/(admin)/team/**` | Propietaria en la lista y nº de colegiado (modificar). |
| `apps/admin/app/(admin)/layout.tsx`, `page.tsx` | Menú e inicio (modificar). |
| `packages/ui/src/components/textarea.tsx` | Área de texto (crear). |
| `e2e/admin-config.spec.ts` | Recorridos de configuración (crear). |

---

### Task 1: Servicios en la base de datos

**Files:**
- Create: `packages/db/supabase/migrations/20260926090000_servicios.sql`, `packages/db/supabase/tests/services.test.sql`
- Modify: `packages/db/supabase/seed.sql`, `packages/db/supabase/tests/seed.test.sql`, `packages/db/types.ts`

**Interfaces:**
- Produces: enums `public.vat_treatment` (`exempt`, `standard_21`) y `public.booking_payment` (`none`, `fixed`, `percent`, `full`); tabla `public.services(id, specialty_id, name, duration_minutes, price_cents, vat, bookable_online, booking_payment, booking_payment_value, cancellation_hours, is_active, created_at, updated_at)`; `specialties` ya no se puede borrar si tiene servicios (`on delete restrict`).

- [ ] **Step 1: pgTAP que falla**

`packages/db/supabase/tests/services.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'owner-svc@test.local'),
  ('10000000-0000-0000-0000-000000000002', 'employee-svc@test.local'),
  ('10000000-0000-0000-0000-000000000003', 'inactive-svc@test.local');
insert into public.profiles (id, email, full_name, role, is_active) values
  ('10000000-0000-0000-0000-000000000001', 'owner-svc@test.local', 'Owner', 'owner', true),
  ('10000000-0000-0000-0000-000000000002', 'employee-svc@test.local', 'Employee', 'employee', true),
  ('10000000-0000-0000-0000-000000000003', 'inactive-svc@test.local', 'Inactive', 'employee', false);
insert into public.specialties (id, name, slug) values
  ('10000000-0000-0000-0000-0000000000aa', 'Svc test', 'svc-test');

create or replace function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents, vat, bookable_online, booking_payment, booking_payment_value)
  values ('10000000-0000-0000-0000-0000000000aa', 'Sesión 60', 60, 4500, 'exempt', true, 'fixed', 1000)
$$, 'the owner can create a service');

select throws_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents, booking_payment, booking_payment_value)
  values ('10000000-0000-0000-0000-0000000000aa', 'Señal mayor que el precio', 30, 1000, 'fixed', 2000)
$$, '23514', null, 'a fixed deposit can never exceed the price');

select throws_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents, booking_payment, booking_payment_value)
  values ('10000000-0000-0000-0000-0000000000aa', 'Porcentaje imposible', 30, 1000, 'percent', 150)
$$, '23514', null, 'a percentage deposit must be between 1 and 100');

select throws_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents)
  values ('10000000-0000-0000-0000-0000000000aa', 'Sin duración', 0, 1000)
$$, '23514', null, 'a service needs a real duration');

select throws_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents)
  values ('10000000-0000-0000-0000-0000000000aa', 'Sesión 60', 60, 4500)
$$, '23505', null, 'two services of the same specialty cannot share a name');

select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select is((select count(*) from public.services where name = 'Sesión 60'), 1::bigint,
  'an active employee can read services, which the agenda will need');
select throws_ok($$
  insert into public.services (specialty_id, name, duration_minutes, price_cents)
  values ('10000000-0000-0000-0000-0000000000aa', 'Intruso', 30, 1000)
$$, '42501', null, 'an employee cannot create services');

select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
select is((select count(*) from public.services where name = 'Sesión 60'), 0::bigint,
  'a deactivated employee sees no services');

reset role;
select throws_ok($$ delete from public.specialties where id = '10000000-0000-0000-0000-0000000000aa' $$,
  '23503', null, 'a specialty with services cannot be deleted');

select * from finish();
rollback;
```

Run: `make db.reset && make test.db` → Expected: FAIL (`relation "public.services" does not exist`).

- [ ] **Step 2: Migración**

`packages/db/supabase/migrations/20260926090000_servicios.sql`:

```sql
create type public.vat_treatment as enum ('exempt', 'standard_21');
create type public.booking_payment as enum ('none', 'fixed', 'percent', 'full');

create table public.services (
  id uuid primary key default gen_random_uuid(),
  specialty_id uuid not null references public.specialties(id) on delete restrict,
  name text not null check (length(trim(name)) > 0),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  price_cents integer not null check (price_cents >= 0),
  vat public.vat_treatment not null default 'exempt',
  bookable_online boolean not null default false,
  booking_payment public.booking_payment not null default 'none',
  booking_payment_value integer not null default 0,
  cancellation_hours integer check (cancellation_hours between 0 and 720),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (specialty_id, name),
  constraint services_booking_payment_value check (
    (booking_payment in ('none', 'full') and booking_payment_value = 0)
    or (booking_payment = 'fixed' and booking_payment_value > 0 and booking_payment_value <= price_cents)
    or (booking_payment = 'percent' and booking_payment_value between 1 and 100)
  )
);

create index services_specialty_idx on public.services(specialty_id);

create trigger services_touch
  before update on public.services
  for each row execute function public.touch_updated_at();

alter table public.services enable row level security;

create policy "services_select_active_staff"
  on public.services for select to authenticated
  using (public.is_active_staff());

create policy "services_insert_owner"
  on public.services for insert to authenticated
  with check (public.is_owner());

create policy "services_update_owner"
  on public.services for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

create policy "services_delete_owner"
  on public.services for delete to authenticated
  using (public.is_owner());
```

Run: `make db.reset && make test.db` → Expected: PASS (los tests existentes y los 9 nuevos).

- [ ] **Step 3: Seed y tipos**

Añade al final de `seed.sql` servicios de ejemplo (precios de ejemplo, solo local):

```sql
insert into public.services (id, specialty_id, name, duration_minutes, price_cents, vat, bookable_online, booking_payment, booking_payment_value) values
  ('a0000000-0000-0000-0000-0000000005a1', 'a0000000-0000-0000-0000-00000000001a', 'Valoración inicial', 60, 6000, 'exempt', true, 'fixed', 1000),
  ('a0000000-0000-0000-0000-0000000005a2', 'a0000000-0000-0000-0000-00000000001a', 'Sesión de logopedia', 45, 4000, 'exempt', true, 'none', 0),
  ('a0000000-0000-0000-0000-0000000005b1', 'a0000000-0000-0000-0000-00000000001b', 'Psicoterapia individual', 60, 5500, 'exempt', true, 'percent', 20),
  ('a0000000-0000-0000-0000-0000000005b2', 'a0000000-0000-0000-0000-00000000001b', 'Informe psicológico no sanitario', 60, 9000, 'standard_21', false, 'none', 0),
  ('a0000000-0000-0000-0000-0000000005c1', 'a0000000-0000-0000-0000-00000000001c', 'Sesión individual de fisioterapia', 60, 4500, 'exempt', true, 'fixed', 1000),
  ('a0000000-0000-0000-0000-0000000005c2', 'a0000000-0000-0000-0000-00000000001c', 'Sesión de control', 30, 3000, 'exempt', true, 'none', 0)
on conflict (id) do nothing;
```

En `tests/seed.test.sql` añade (y sube `plan(n)`): `select is((select count(*) from public.services), 6::bigint, 'the development seed has example services for the three specialties');`.

Run: `make db.reset && make test.db && make db.types && make db.types.check` → Expected: PASS; `types.ts` contiene `services` y `vat_treatment`.

- [ ] **Step 4: Commit**

```bash
git add packages/db
git commit -m "Añadir servicios con duración, precio, IVA y pago al reservar"
```

---

### Task 2: Validar el formulario de servicios

**Files:**
- Create: `apps/admin/lib/money.ts`, `apps/admin/lib/money.test.ts`, `apps/admin/lib/service-form.ts`, `apps/admin/lib/service-form.test.ts`

**Interfaces:**
- Produces:
  - `parseEurosToCents(input: string): number | null`, `formatCents(cents: number): string` (→ `"45,00 €"`)
  - `type ServiceInput = { specialty_id: string; name: string; duration_minutes: number; price_cents: number; vat: "exempt" | "standard_21"; bookable_online: boolean; booking_payment: "none" | "fixed" | "percent" | "full"; booking_payment_value: number; cancellation_hours: number | null }`
  - `parseServiceForm(formData: FormData): { ok: true; service: ServiceInput } | { error: string }`

- [ ] **Step 1: Tests que fallan**

`apps/admin/lib/money.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatCents, parseEurosToCents } from "./money";

describe("parseEurosToCents", () => {
  it("understands prices typed the Spanish way", () => {
    expect(parseEurosToCents("45")).toBe(4500);
    expect(parseEurosToCents("45,5")).toBe(4550);
    expect(parseEurosToCents("45,50")).toBe(4550);
    expect(parseEurosToCents("1.234,00")).toBe(123400);
    expect(parseEurosToCents(" 45 € ")).toBe(4500);
  });

  it("also accepts a dot as decimal separator", () => {
    expect(parseEurosToCents("45.50")).toBe(4550);
  });

  it("rejects anything that is not an unambiguous positive amount, instead of saving a wrong price", () => {
    expect(parseEurosToCents("")).toBeNull();
    expect(parseEurosToCents("-5")).toBeNull();
    expect(parseEurosToCents("45,555")).toBeNull();
    expect(parseEurosToCents("cuarenta")).toBeNull();
  });
});

describe("formatCents", () => {
  it("shows amounts as the clinic writes them", () => {
    expect(formatCents(4550)).toBe("45,50 €");
    expect(formatCents(123400)).toBe("1234,00 €");
  });
});
```

`apps/admin/lib/service-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseServiceForm } from "./service-form";

function form(values: Record<string, string>) {
  const data = new FormData();
  const defaults: Record<string, string> = {
    specialty_id: "spec-1",
    name: "Sesión individual",
    duration_minutes: "60",
    price: "45,00",
    vat: "exempt",
    booking_payment: "none",
    booking_payment_value: "",
    cancellation_hours: "",
  };
  for (const [key, value] of Object.entries({ ...defaults, ...values })) {
    data.set(key, value);
  }
  return data;
}

describe("parseServiceForm", () => {
  it("turns the form into a service with the price in cents", () => {
    const result = parseServiceForm(form({ bookable_online: "on" }));
    expect(result).toEqual({
      ok: true,
      service: {
        specialty_id: "spec-1",
        name: "Sesión individual",
        duration_minutes: 60,
        price_cents: 4500,
        vat: "exempt",
        bookable_online: true,
        booking_payment: "none",
        booking_payment_value: 0,
        cancellation_hours: null,
      },
    });
  });

  it("stores a fixed deposit in cents and refuses one above the price", () => {
    expect(parseServiceForm(form({ booking_payment: "fixed", booking_payment_value: "10" }))).toHaveProperty("service.booking_payment_value", 1000);
    expect(parseServiceForm(form({ booking_payment: "fixed", booking_payment_value: "50" }))).toEqual({
      error: "La señal no puede ser mayor que el precio.",
    });
  });

  it("requires a percentage between 1 and 100", () => {
    expect(parseServiceForm(form({ booking_payment: "percent", booking_payment_value: "20" }))).toHaveProperty("service.booking_payment_value", 20);
    expect(parseServiceForm(form({ booking_payment: "percent", booking_payment_value: "0" }))).toEqual({
      error: "El porcentaje debe estar entre 1 y 100.",
    });
  });

  it("ignores any deposit value when nothing or the full price is paid at booking", () => {
    expect(parseServiceForm(form({ booking_payment: "full", booking_payment_value: "99" }))).toHaveProperty("service.booking_payment_value", 0);
  });

  it("keeps a per-service cancellation window only when it is filled in", () => {
    expect(parseServiceForm(form({ cancellation_hours: "48" }))).toHaveProperty("service.cancellation_hours", 48);
    expect(parseServiceForm(form({ cancellation_hours: "800" }))).toEqual({
      error: "El plazo de cancelación debe estar entre 0 y 720 horas.",
    });
  });

  it("rejects missing or invalid basics with a clear message", () => {
    expect(parseServiceForm(form({ name: " " }))).toEqual({ error: "El nombre es obligatorio." });
    expect(parseServiceForm(form({ specialty_id: "" }))).toEqual({ error: "Elige una especialidad." });
    expect(parseServiceForm(form({ duration_minutes: "0" }))).toEqual({ error: "La duración debe estar entre 5 y 480 minutos." });
    expect(parseServiceForm(form({ price: "cuarenta" }))).toEqual({ error: "El precio no es válido. Escríbelo como 45 o 45,50." });
    expect(parseServiceForm(form({ vat: "10" }))).toEqual({ error: "Elige el tratamiento de IVA." });
  });
});
```

Run: `pnpm --filter admin test` → Expected: FAIL (módulos inexistentes).

- [ ] **Step 2: Implementar**

`apps/admin/lib/money.ts`:

```ts
export function parseEurosToCents(input: string): number | null {
  const cleaned = input.replace(/€/g, "").replace(/\s/g, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

export function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}
```

`apps/admin/lib/service-form.ts`:

```ts
import { parseEurosToCents } from "./money";

const VATS = ["exempt", "standard_21"] as const;
const PAYMENTS = ["none", "fixed", "percent", "full"] as const;

export type ServiceInput = {
  specialty_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  vat: (typeof VATS)[number];
  bookable_online: boolean;
  booking_payment: (typeof PAYMENTS)[number];
  booking_payment_value: number;
  cancellation_hours: number | null;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isOneOf<T extends string>(value: string, options: readonly T[]): value is T {
  return (options as readonly string[]).includes(value);
}

export function parseServiceForm(
  formData: FormData,
): { ok: true; service: ServiceInput } | { error: string } {
  const specialtyId = text(formData, "specialty_id");
  const name = text(formData, "name");
  const duration = Number(text(formData, "duration_minutes"));
  const price = parseEurosToCents(text(formData, "price"));
  const vat = text(formData, "vat");
  const payment = text(formData, "booking_payment");
  const rawValue = text(formData, "booking_payment_value");
  const rawCancellation = text(formData, "cancellation_hours");

  if (!specialtyId) return { error: "Elige una especialidad." };
  if (!name) return { error: "El nombre es obligatorio." };
  if (!Number.isInteger(duration) || duration < 5 || duration > 480)
    return { error: "La duración debe estar entre 5 y 480 minutos." };
  if (price === null)
    return { error: "El precio no es válido. Escríbelo como 45 o 45,50." };
  if (!isOneOf(vat, VATS)) return { error: "Elige el tratamiento de IVA." };
  if (!isOneOf(payment, PAYMENTS))
    return { error: "Elige qué se paga al reservar." };

  let paymentValue = 0;
  if (payment === "fixed") {
    const deposit = parseEurosToCents(rawValue);
    if (deposit === null || deposit === 0)
      return { error: "Indica el importe de la señal." };
    if (deposit > price)
      return { error: "La señal no puede ser mayor que el precio." };
    paymentValue = deposit;
  }
  if (payment === "percent") {
    const percent = Number(rawValue);
    if (!Number.isInteger(percent) || percent < 1 || percent > 100)
      return { error: "El porcentaje debe estar entre 1 y 100." };
    paymentValue = percent;
  }

  let cancellation: number | null = null;
  if (rawCancellation) {
    const hours = Number(rawCancellation);
    if (!Number.isInteger(hours) || hours < 0 || hours > 720)
      return { error: "El plazo de cancelación debe estar entre 0 y 720 horas." };
    cancellation = hours;
  }

  return {
    ok: true,
    service: {
      specialty_id: specialtyId,
      name,
      duration_minutes: duration,
      price_cents: price,
      vat,
      bookable_online: formData.get("bookable_online") === "on",
      booking_payment: payment,
      booking_payment_value: paymentValue,
      cancellation_hours: cancellation,
    },
  };
}
```

Run: `pnpm --filter admin test` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/lib
git commit -m "Validar precios en euros y el formulario de servicios"
```

---

### Task 3: Pantalla de servicios

**Files:**
- Create: `apps/admin/app/(admin)/services/page.tsx`, `services/actions.ts`, `services/actions.test.ts`, `services/ServiceForm.tsx`, `services/ServiceStatusToggle.tsx`, `services/new/page.tsx`, `services/[id]/page.tsx`, `e2e/admin-config.spec.ts`
- Modify: `apps/admin/app/(admin)/layout.tsx`

**Interfaces:**
- Consumes: `parseServiceForm`, `formatCents` (Tarea 2); tabla `services` (Tarea 1); `requireOwner`; componentes `@clinicalumia/ui`.
- Produces: `saveService(prev: ServiceFormState, formData: FormData): Promise<ServiceFormState>` (crea o actualiza según el campo oculto `id`; al terminar `redirect("/services")`); `setServiceActive(id: string, isActive: boolean): Promise<ActionResult>`; `data-testid`: `service-row`, `service-new`, `service-edit`, `service-toggle`, `service-form`, `service-error`, `service-submit`.

- [ ] **Step 1: e2e que falla**

`e2e/admin-config.spec.ts` (usa la cuenta del seed, crea con nombres únicos y limpia):

```ts
import { execSync } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];
const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");
const ADMIN = "http://localhost:3002";
const createdServiceNames: string[] = [];

async function loginAsSeedOwner(page: Page) {
  await page.goto(`${ADMIN}/login`);
  await page.fill('[name="email"]', "info@clinicalumia.es");
  await page.fill('[name="password"]', "lumia-desarrollo-2026");
  await page.getByTestId("login-submit").click();
  await expect(page.getByRole("navigation", { name: "Secciones" })).toBeVisible();
}

test.afterEach(async () => {
  if (createdServiceNames.length > 0) {
    await admin.from("services").delete().in("name", createdServiceNames.splice(0));
  }
});

test("the owner creates a service with a deposit and sees it listed with its price", async ({ page }) => {
  await loginAsSeedOwner(page);
  const name = `Sesión e2e ${Date.now()}`;
  createdServiceNames.push(name);
  await page.goto(`${ADMIN}/services`);
  await page.getByTestId("service-new").click();
  await page.getByLabel("Especialidad").selectOption({ label: "Fisioterapia" });
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Duración (minutos)").fill("45");
  await page.getByLabel("Precio").fill("50");
  await page.getByLabel("Qué se paga al reservar").selectOption("fixed");
  await page.getByLabel("Importe de la señal").fill("60");
  await page.getByTestId("service-submit").click();
  await expect(page.getByTestId("service-error")).toContainText("La señal no puede ser mayor que el precio.");
  await expect(page.getByLabel("Nombre")).toHaveValue(name);
  await page.getByLabel("Importe de la señal").fill("10");
  await page.getByTestId("service-submit").click();
  const row = page.getByTestId("service-row").filter({ hasText: name });
  await expect(row).toContainText("50,00 €");
  await expect(row).toContainText("Señal 10,00 €");
});
```

Run: `make test.e2e` → Expected: FAIL (`/services` no existe).

- [ ] **Step 2: Acciones con sus tests**

`services/actions.test.ts` (mismo estilo de mocks que `specialties/actions.test.ts`): (a) una no propietaria recibe el error de permiso y no se inserta nada; (b) un formulario inválido devuelve el error del parser sin tocar la base de datos; (c) un error `23505` al crear devuelve "Ya existe un servicio con ese nombre en esa especialidad."; (d) `setServiceActive` devuelve el error si la base de datos falla.

`services/actions.ts`:

```ts
"use server";

import { requireOwner } from "@clinicalumia/api/auth";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { parseServiceForm } from "@/lib/service-form";

export type ServiceFormState = { error: string } | undefined;

export async function saveService(
  _prev: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const parsed = parseServiceForm(formData);
  if ("error" in parsed) return parsed;

  const id = String(formData.get("id") ?? "");
  const { error } = id
    ? await supabase.from("services").update(parsed.service).eq("id", id)
    : await supabase.from("services").insert(parsed.service);

  if (error?.code === "23505")
    return { error: "Ya existe un servicio con ese nombre en esa especialidad." };
  if (error) return { error: "No se ha podido guardar el servicio." };

  revalidatePath("/services");
  redirect("/services");
}

export async function setServiceActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const { error } = await supabase
    .from("services")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: "No se ha podido cambiar el estado del servicio." };

  revalidatePath("/services");
  return { ok: true };
}
```

- [ ] **Step 3: Formulario**

`services/ServiceForm.tsx`:

```tsx
"use client";

import { Button } from "@clinicalumia/ui/button";
import { CheckboxField } from "@clinicalumia/ui/checkbox-field";
import { Field } from "@clinicalumia/ui/field";
import { Input } from "@clinicalumia/ui/input";
import { Select } from "@clinicalumia/ui/select";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { type ServiceFormState, saveService } from "./actions";

type Specialty = { id: string; name: string };
type Service = {
  id: string;
  specialty_id: string;
  name: string;
  duration_minutes: number;
  price_cents: number;
  vat: "exempt" | "standard_21";
  bookable_online: boolean;
  booking_payment: "none" | "fixed" | "percent" | "full";
  booking_payment_value: number;
  cancellation_hours: number | null;
};

function centsToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function ServiceForm({
  specialties,
  service,
}: {
  specialties: Specialty[];
  service?: Service;
}) {
  const [state, formAction, pending] = useActionState<ServiceFormState, FormData>(saveService, undefined);
  const [payment, setPayment] = useState(service?.booking_payment ?? "none");

  return (
    <form
      data-testid="service-form"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => formAction(formData));
      }}
      className="flex flex-col gap-5"
    >
      {service && <input type="hidden" name="id" value={service.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Especialidad">
          <Select name="specialty_id" defaultValue={service?.specialty_id ?? ""} required>
            <option value="" disabled>Elige una especialidad</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Nombre">
          <Input name="name" defaultValue={service?.name} required />
        </Field>
        <Field label="Duración (minutos)">
          <Input name="duration_minutes" type="number" min={5} max={480} step={5} defaultValue={service?.duration_minutes ?? 60} required />
        </Field>
        <Field label="Precio" hint="En euros, por ejemplo 45 o 45,50.">
          <Input name="price" inputMode="decimal" defaultValue={service ? centsToInput(service.price_cents) : ""} required />
        </Field>
        <Field label="IVA">
          <Select name="vat" defaultValue={service?.vat ?? "exempt"}>
            <option value="exempt">Exento · servicio sanitario</option>
            <option value="standard_21">21 %</option>
          </Select>
        </Field>
        <Field label="Plazo de cancelación propio (horas)" hint="Déjalo vacío para usar el de la clínica.">
          <Input name="cancellation_hours" type="number" min={0} max={720} defaultValue={service?.cancellation_hours ?? ""} />
        </Field>
      </div>

      <CheckboxField name="bookable_online" label="Se puede reservar desde la web" defaultChecked={service?.bookable_online ?? false} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Qué se paga al reservar">
          <Select name="booking_payment" value={payment} onChange={(event) => setPayment(event.target.value as Service["booking_payment"])}>
            <option value="none">Nada, se paga en la clínica</option>
            <option value="fixed">Una señal fija</option>
            <option value="percent">Un porcentaje</option>
            <option value="full">El precio completo</option>
          </Select>
        </Field>
        {payment === "fixed" && (
          <Field label="Importe de la señal" hint="En euros.">
            <Input name="booking_payment_value" inputMode="decimal" defaultValue={service?.booking_payment === "fixed" ? centsToInput(service.booking_payment_value) : ""} required />
          </Field>
        )}
        {payment === "percent" && (
          <Field label="Porcentaje del precio">
            <Input name="booking_payment_value" type="number" min={1} max={100} defaultValue={service?.booking_payment === "percent" ? service.booking_payment_value : ""} required />
          </Field>
        )}
      </div>

      {state?.error && (
        <p role="alert" data-testid="service-error" className="text-[13px] text-danger-600">{state.error}</p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" disabled={pending} data-testid="service-submit">
          {pending ? "Guardando…" : "Guardar servicio"}
        </Button>
        <Button asChild variant="secondary">
          <Link href="/services">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Páginas y estado**

`services/ServiceStatusToggle.tsx`:

```tsx
"use client";

import { Button } from "@clinicalumia/ui/button";
import { useState, useTransition } from "react";
import { setServiceActive } from "./actions";

export function ServiceStatusToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant={isActive ? "danger" : "secondary"}
        disabled={pending}
        data-testid="service-toggle"
        onClick={() =>
          startTransition(async () => {
            const result = await setServiceActive(id, !isActive);
            setError("error" in result ? result.error : null);
          })
        }
      >
        {isActive ? "Desactivar" : "Activar"}
      </Button>
      {error && <p role="alert" className="text-[13px] text-danger-600">{error}</p>}
    </div>
  );
}
```

`services/page.tsx`:

```tsx
import { createClient } from "@clinicalumia/api/server";
import { Badge } from "@clinicalumia/ui/badge";
import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@clinicalumia/ui/table";
import Link from "next/link";
import { formatCents } from "@/lib/money";
import { ServiceStatusToggle } from "./ServiceStatusToggle";

function bookingLabel(payment: string, value: number) {
  if (payment === "fixed") return `Señal ${formatCents(value)}`;
  if (payment === "percent") return `Señal ${value} %`;
  if (payment === "full") return "Pago completo";
  return "Paga en la clínica";
}

export default async function ServicesPage() {
  const supabase = await createClient();
  const [{ data: specialties }, { data: services }] = await Promise.all([
    supabase.from("specialties").select("id, name").order("name"),
    supabase
      .from("services")
      .select("id, specialty_id, name, duration_minutes, price_cents, vat, bookable_online, booking_payment, booking_payment_value, is_active")
      .order("name"),
  ]);

  return (
    <>
      <PageHeader
        title="Servicios"
        description="Lo que ofrece cada especialidad: duración, precio, IVA y qué se paga al reservar."
        actions={
          <Button asChild data-testid="service-new">
            <Link href="/services/new">Nuevo servicio</Link>
          </Button>
        }
      />
      {(specialties ?? []).map((specialty) => {
        const list = (services ?? []).filter((s) => s.specialty_id === specialty.id);
        return (
          <section key={specialty.id} className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-ink-900">{specialty.name}</h2>
            {list.length === 0 ? (
              <Card className="text-sm text-ink-800">Aún no hay servicios en esta especialidad.</Card>
            ) : (
              <Table aria-label={`Servicios de ${specialty.name}`}>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Servicio</TableHeaderCell>
                    <TableHeaderCell>Duración</TableHeaderCell>
                    <TableHeaderCell>Precio</TableHeaderCell>
                    <TableHeaderCell>IVA</TableHeaderCell>
                    <TableHeaderCell>Reserva web</TableHeaderCell>
                    <TableHeaderCell>Estado</TableHeaderCell>
                    <TableHeaderCell><span className="sr-only">Acciones</span></TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {list.map((service) => (
                    <TableRow key={service.id} data-testid="service-row">
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell>{service.duration_minutes} min</TableCell>
                      <TableCell>{formatCents(service.price_cents)}</TableCell>
                      <TableCell>{service.vat === "exempt" ? "Exento" : <Badge tone="outline">21 %</Badge>}</TableCell>
                      <TableCell>{service.bookable_online ? bookingLabel(service.booking_payment, service.booking_payment_value) : "No"}</TableCell>
                      <TableCell>
                        <Badge tone={service.is_active ? "success" : "neutral"}>{service.is_active ? "Activo" : "Inactivo"}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button asChild size="sm" variant="secondary" data-testid="service-edit">
                            <Link href={`/services/${service.id}`}>Editar</Link>
                          </Button>
                          <ServiceStatusToggle id={service.id} isActive={service.is_active} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        );
      })}
    </>
  );
}
```

`services/new/page.tsx`:

```tsx
import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { ServiceForm } from "../ServiceForm";

export default async function NewServicePage() {
  const supabase = await createClient();
  const { data: specialties } = await supabase.from("specialties").select("id, name").order("name");
  return (
    <>
      <PageHeader title="Nuevo servicio" />
      <Card>
        <ServiceForm specialties={specialties ?? []} />
      </Card>
    </>
  );
}
```

`services/[id]/page.tsx`:

```tsx
import { createClient } from "@clinicalumia/api/server";
import { Card } from "@clinicalumia/ui/card";
import { PageHeader } from "@clinicalumia/ui/page-header";
import { notFound } from "next/navigation";
import { ServiceForm } from "../ServiceForm";

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: specialties }, { data: service }] = await Promise.all([
    supabase.from("specialties").select("id, name").order("name"),
    supabase
      .from("services")
      .select("id, specialty_id, name, duration_minutes, price_cents, vat, bookable_online, booking_payment, booking_payment_value, cancellation_hours")
      .eq("id", id)
      .maybeSingle(),
  ]);
  if (!service) notFound();
  return (
    <>
      <PageHeader title="Editar servicio" description={service.name} />
      <Card>
        <ServiceForm specialties={specialties ?? []} service={service} />
      </Card>
    </>
  );
}
```

En `layout.tsx`, el `nav` pasa a: Inicio, Equipo (`/team`), Especialidades (`/specialties`), Servicios (`/services`) (Horarios y Datos de la clínica se añaden en sus tareas).

- [ ] **Step 5: Verificar**

Run: `make lint && make typecheck && make test && make test.db && make test.e2e`
Expected: PASS, incluido el nuevo e2e. A 390px, la tabla de servicios hace scroll horizontal dentro de su panel sin desbordar la página (el `Table` ya envuelve en `overflow-x-auto`).

- [ ] **Step 6: Commits**

```bash
git add "apps/admin/app/(admin)/services/actions.ts" "apps/admin/app/(admin)/services/actions.test.ts"
git commit -m "Guardar y activar servicios desde el admin"
git add "apps/admin/app/(admin)/services" "apps/admin/app/(admin)/layout.tsx" e2e/admin-config.spec.ts
git commit -m "Añadir la pantalla de servicios al admin"
```

---

### Task 4: Horarios y ausencias en la base de datos

**Files:**
- Create: `packages/db/supabase/migrations/20260926100000_horarios_y_ausencias.sql`, `packages/db/supabase/tests/schedules.test.sql`
- Modify: `seed.sql`, `tests/seed.test.sql`, `types.ts`

**Interfaces:**
- Produces: `public.employee_schedules(id, profile_id, weekday 1–7 (1 = lunes), starts_at time, ends_at time)` sin solapes por persona y día; `public.employee_time_off(id, profile_id, starts_at timestamptz, ends_at timestamptz, reason text)`; `public.set_employee_schedule(target uuid, blocks jsonb) returns void` que sustituye el horario en una transacción. `blocks`: `[{ "weekday": 1, "starts_at": "15:15", "ends_at": "20:30" }]`.

- [ ] **Step 1: pgTAP que falla**

`packages/db/supabase/tests/schedules.test.sql` — mismo arranque que `services.test.sql` (propietaria activa, empleada activa y empleada inactiva con UUIDs `20000000-…`, helper `act_as`) y estas aserciones:

```sql
select pg_temp.act_as('20000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.set_employee_schedule('20000000-0000-0000-0000-000000000002',
  '[{"weekday":1,"starts_at":"15:15","ends_at":"20:30"},{"weekday":2,"starts_at":"09:00","ends_at":"13:00"}]') $$,
  'the owner sets an employee weekly schedule in one call');
select is((select count(*) from public.employee_schedules where profile_id = '20000000-0000-0000-0000-000000000002'), 2::bigint,
  'both blocks are stored');
select lives_ok($$ select public.set_employee_schedule('20000000-0000-0000-0000-000000000002',
  '[{"weekday":3,"starts_at":"10:00","ends_at":"14:00"}]') $$, 'saving again replaces the schedule');
select is((select count(*) from public.employee_schedules where profile_id = '20000000-0000-0000-0000-000000000002'), 1::bigint,
  'the previous blocks are gone, not duplicated');
select throws_ok($$ select public.set_employee_schedule('20000000-0000-0000-0000-000000000002',
  '[{"weekday":4,"starts_at":"10:00","ends_at":"12:00"},{"weekday":4,"starts_at":"11:00","ends_at":"13:00"}]') $$,
  '23P01', null, 'overlapping blocks on the same day are rejected');
select is((select count(*) from public.employee_schedules where profile_id = '20000000-0000-0000-0000-000000000002'), 1::bigint,
  'a rejected save leaves the previous schedule intact');
select throws_ok($$ insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at)
  values ('20000000-0000-0000-0000-000000000002', 5, '14:00', '10:00') $$, '23514', null,
  'a block must end after it starts');
select lives_ok($$ insert into public.employee_time_off (profile_id, starts_at, ends_at, reason)
  values ('20000000-0000-0000-0000-000000000002', '2026-12-24 00:00+01', '2026-12-26 23:59+01', 'Navidad') $$,
  'the owner records time off');

select pg_temp.act_as('20000000-0000-0000-0000-000000000002');
select is((select count(*) from public.employee_schedules), 1::bigint, 'an active employee can read schedules');
select throws_ok($$ select public.set_employee_schedule('20000000-0000-0000-0000-000000000002', '[]') $$,
  '42501', null, 'an employee cannot change schedules, not even their own');

select pg_temp.act_as('20000000-0000-0000-0000-000000000003');
select is((select count(*) from public.employee_time_off), 0::bigint, 'a deactivated employee sees no time off');
```

(`plan(11)`, `finish()` y `rollback` como en los otros tests.) Si `set_employee_schedule` como empleado no lanza `42501` porque el `delete` bajo RLS no afecta filas, haz que la función compruebe `public.is_owner()` al principio y lance `raise exception using errcode = '42501'`; el test fija el comportamiento, no el mecanismo.

Run: `make db.reset && make test.db` → Expected: FAIL.

- [ ] **Step 2: Migración**

```sql
create extension if not exists btree_gist with schema extensions;

create table public.employee_schedules (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  check (starts_at < ends_at),
  constraint employee_schedules_no_overlap exclude using gist (
    profile_id with =,
    weekday with =,
    tsrange('2000-01-01'::date + starts_at, '2000-01-01'::date + ends_at) with &&
  )
);

create index employee_schedules_profile_idx on public.employee_schedules(profile_id);

create table public.employee_time_off (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  check (starts_at < ends_at)
);

create index employee_time_off_profile_idx on public.employee_time_off(profile_id, starts_at);

alter table public.employee_schedules enable row level security;
alter table public.employee_time_off enable row level security;

create policy "employee_schedules_select_active_staff" on public.employee_schedules
  for select to authenticated using (public.is_active_staff());
create policy "employee_schedules_write_owner" on public.employee_schedules
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "employee_time_off_select_active_staff" on public.employee_time_off
  for select to authenticated using (public.is_active_staff());
create policy "employee_time_off_write_owner" on public.employee_time_off
  for all to authenticated using (public.is_owner()) with check (public.is_owner());

create or replace function public.set_employee_schedule(target uuid, blocks jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not public.is_owner() then
    raise exception 'only the owner can change schedules' using errcode = '42501';
  end if;
  delete from public.employee_schedules where profile_id = target;
  insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at)
  select target, (block->>'weekday')::smallint, (block->>'starts_at')::time, (block->>'ends_at')::time
  from jsonb_array_elements(blocks) as block;
end;
$$;

grant execute on function public.set_employee_schedule(uuid, jsonb) to authenticated;
```

Si Postgres no encuentra la clase de operadores GiST para `uuid`/`smallint` (por estar `btree_gist` en el esquema `extensions`), califícalas: `profile_id extensions.gist_uuid_ops with =`, `weekday extensions.gist_int2_ops with =`, y anótalo en el informe.

Run: `make db.reset && make test.db` → Expected: PASS.

- [ ] **Step 3: Seed y tipos**

Horario de ejemplo en `seed.sql` (tardes de 15:15 a 20:30 de lunes a viernes para las tres cuentas; mañanas de martes y jueves para Patricia de 9:30 a 13:30):

```sql
insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at)
select profile_id, weekday, '15:15', '20:30'
from (values ('a0000000-0000-0000-0000-000000000001'::uuid), ('a0000000-0000-0000-0000-000000000002'::uuid), ('a0000000-0000-0000-0000-000000000003'::uuid)) as p(profile_id)
cross join generate_series(1, 5) as weekday;

insert into public.employee_schedules (profile_id, weekday, starts_at, ends_at) values
  ('a0000000-0000-0000-0000-000000000001', 2, '09:30', '13:30'),
  ('a0000000-0000-0000-0000-000000000001', 4, '09:30', '13:30');
```

En `seed.test.sql`: `select is((select count(*) from public.employee_schedules), 17::bigint, 'the seed gives every team member a realistic weekly schedule');`.

Run: `make db.reset && make test.db && make db.types && make db.types.check` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db
git commit -m "Añadir horarios semanales sin solapes y ausencias del equipo"
```

---

### Task 5: Validar el horario

**Files:**
- Create: `apps/admin/lib/schedule.ts`, `apps/admin/lib/schedule.test.ts`

**Interfaces:**
- Produces: `type ScheduleBlock = { weekday: number; starts_at: string; ends_at: string }`; `validateSchedule(blocks: ScheduleBlock[]): { ok: true; blocks: ScheduleBlock[] } | { error: string }` (ordena por día y hora); `WEEKDAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]` (índice 0 = weekday 1).

- [ ] **Step 1: Tests (fallan)**

```ts
import { describe, expect, it } from "vitest";
import { validateSchedule } from "./schedule";

describe("validateSchedule", () => {
  it("accepts separate blocks and returns them ordered by day and time", () => {
    expect(validateSchedule([
      { weekday: 2, starts_at: "15:15", ends_at: "20:30" },
      { weekday: 1, starts_at: "15:15", ends_at: "20:30" },
      { weekday: 1, starts_at: "09:30", ends_at: "13:30" },
    ])).toEqual({
      ok: true,
      blocks: [
        { weekday: 1, starts_at: "09:30", ends_at: "13:30" },
        { weekday: 1, starts_at: "15:15", ends_at: "20:30" },
        { weekday: 2, starts_at: "15:15", ends_at: "20:30" },
      ],
    });
  });

  it("names the day when two blocks overlap, so the owner knows what to fix", () => {
    expect(validateSchedule([
      { weekday: 3, starts_at: "10:00", ends_at: "12:00" },
      { weekday: 3, starts_at: "11:30", ends_at: "13:00" },
    ])).toEqual({ error: "El miércoles tiene dos tramos que se solapan." });
  });

  it("allows one block to start exactly when the previous one ends", () => {
    expect(validateSchedule([
      { weekday: 1, starts_at: "09:00", ends_at: "13:00" },
      { weekday: 1, starts_at: "13:00", ends_at: "14:00" },
    ])).toHaveProperty("ok", true);
  });

  it("rejects a block that ends before it starts or has an invalid time", () => {
    expect(validateSchedule([{ weekday: 5, starts_at: "14:00", ends_at: "10:00" }])).toEqual({
      error: "El viernes tiene un tramo que termina antes de empezar.",
    });
    expect(validateSchedule([{ weekday: 1, starts_at: "25:00", ends_at: "26:00" }])).toEqual({
      error: "Hay una hora no válida en el lunes.",
    });
  });

  it("accepts an empty schedule, for someone who does not see patients", () => {
    expect(validateSchedule([])).toEqual({ ok: true, blocks: [] });
  });
});
```

Run: `pnpm --filter admin test` → Expected: FAIL.

- [ ] **Step 2: Implementar**

```ts
export type ScheduleBlock = { weekday: number; starts_at: string; ends_at: string };

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

function minutes(time: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function dayName(weekday: number) {
  return (WEEKDAYS[weekday - 1] ?? "").toLowerCase();
}

export function validateSchedule(
  blocks: ScheduleBlock[],
): { ok: true; blocks: ScheduleBlock[] } | { error: string } {
  const sorted = [...blocks].sort(
    (a, b) => a.weekday - b.weekday || a.starts_at.localeCompare(b.starts_at),
  );
  for (const [index, block] of sorted.entries()) {
    const start = minutes(block.starts_at);
    const end = minutes(block.ends_at);
    if (block.weekday < 1 || block.weekday > 7 || start === null || end === null)
      return { error: `Hay una hora no válida en el ${dayName(block.weekday)}.` };
    if (start >= end)
      return { error: `El ${dayName(block.weekday)} tiene un tramo que termina antes de empezar.` };
    const previous = sorted[index - 1];
    if (previous && previous.weekday === block.weekday && (minutes(previous.ends_at) ?? 0) > start)
      return { error: `El ${dayName(block.weekday)} tiene dos tramos que se solapan.` };
  }
  return { ok: true, blocks: sorted };
}
```

Run: `pnpm --filter admin test` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/lib/schedule.ts apps/admin/lib/schedule.test.ts
git commit -m "Validar los tramos del horario semanal"
```

---

### Task 6: Pantalla de horarios y ausencias

**Files:**
- Create: `apps/admin/app/(admin)/schedules/page.tsx`, `schedules/actions.ts`, `schedules/actions.test.ts`, `schedules/ScheduleEditor.tsx`, `schedules/TimeOffForm.tsx`, `schedules/TimeOffRow.tsx`
- Modify: `apps/admin/app/(admin)/layout.tsx`, `e2e/admin-config.spec.ts`

**Interfaces:**
- Consumes: `validateSchedule`, `WEEKDAYS`, `ScheduleBlock` (Tarea 5); `set_employee_schedule`, `employee_time_off` (Tarea 4).
- Produces: `saveSchedule(profileId: string, blocks: ScheduleBlock[]): Promise<ActionResult>`; `addTimeOff(prev: TimeOffState, formData: FormData): Promise<TimeOffState>`; `deleteTimeOff(id: string): Promise<ActionResult>`; `data-testid`: `schedule-employee`, `schedule-day-<1..7>`, `schedule-add-<1..7>`, `schedule-start`, `schedule-end`, `schedule-remove`, `schedule-save`, `schedule-error`, `schedule-saved`, `timeoff-form`, `timeoff-row`, `timeoff-error`.

- [ ] **Step 1: e2e que falla**

Añade a `e2e/admin-config.spec.ts` (restaura el horario del seed al terminar con `admin.rpc` no sirve porque exige propietaria: usa el cliente de servicio para borrar e insertar las filas de esa persona en `afterEach`, guardando antes las originales):

```ts
test("the owner edits a weekly schedule, is warned about overlaps, and the change survives a reload", async ({ page }) => {
  const employeeId = "a0000000-0000-0000-0000-000000000002";
  const { data: original } = await admin.from("employee_schedules").select("weekday, starts_at, ends_at").eq("profile_id", employeeId);
  try {
    await loginAsSeedOwner(page);
    await page.goto(`${ADMIN}/schedules`);
    await page.getByTestId("schedule-employee").selectOption({ label: "Laura Ejemplo" });
    const saturday = page.getByTestId("schedule-day-6");
    await page.getByTestId("schedule-add-6").click();
    await saturday.getByTestId("schedule-start").last().fill("10:00");
    await saturday.getByTestId("schedule-end").last().fill("12:00");
    await page.getByTestId("schedule-add-6").click();
    await saturday.getByTestId("schedule-start").last().fill("11:00");
    await saturday.getByTestId("schedule-end").last().fill("13:00");
    await page.getByTestId("schedule-save").click();
    await expect(page.getByTestId("schedule-error")).toContainText("El sábado tiene dos tramos que se solapan.");
    await saturday.getByTestId("schedule-remove").last().click();
    await page.getByTestId("schedule-save").click();
    await expect(page.getByTestId("schedule-saved")).toBeVisible();
    await page.reload();
    await expect(page.getByTestId("schedule-day-6").getByTestId("schedule-start")).toHaveValue("10:00");
  } finally {
    await admin.from("employee_schedules").delete().eq("profile_id", employeeId);
    if (original?.length) {
      await admin.from("employee_schedules").insert(original.map((row) => ({ ...row, profile_id: employeeId })));
    }
  }
});
```

Run: `make test.e2e` → Expected: FAIL.

- [ ] **Step 2: Acciones**

`schedules/actions.ts`:

```ts
"use server";

import { requireOwner } from "@clinicalumia/api/auth";
import { createClient } from "@clinicalumia/api/server";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/lib/action-result";
import { type ScheduleBlock, validateSchedule } from "@/lib/schedule";

export type TimeOffState = { error: string } | { ok: true } | undefined;

export async function saveSchedule(profileId: string, blocks: ScheduleBlock[]): Promise<ActionResult> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const valid = validateSchedule(blocks);
  if ("error" in valid) return valid;

  const { error } = await supabase.rpc("set_employee_schedule", {
    target: profileId,
    blocks: valid.blocks,
  });
  if (error?.code === "23P01") return { error: "Hay tramos que se solapan el mismo día." };
  if (error) return { error: "No se ha podido guardar el horario." };

  revalidatePath("/schedules");
  return { ok: true };
}

export async function addTimeOff(_prev: TimeOffState, formData: FormData): Promise<TimeOffState> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };

  const profileId = String(formData.get("profile_id") ?? "");
  const from = String(formData.get("starts_on") ?? "");
  const to = String(formData.get("ends_on") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!profileId || !from || !to) return { error: "Indica desde y hasta cuándo." };
  if (to < from) return { error: "La fecha final no puede ser anterior a la inicial." };

  const { error } = await supabase.from("employee_time_off").insert({
    profile_id: profileId,
    starts_at: `${from}T00:00:00+02:00`,
    ends_at: `${to}T23:59:59+02:00`,
    reason,
  });
  if (error) return { error: "No se ha podido guardar la ausencia." };

  revalidatePath("/schedules");
  return { ok: true };
}

export async function deleteTimeOff(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const owner = await requireOwner(supabase);
  if (!owner.ok) return { error: owner.error };
  const { error } = await supabase.from("employee_time_off").delete().eq("id", id);
  if (error) return { error: "No se ha podido eliminar la ausencia." };
  revalidatePath("/schedules");
  return { ok: true };
}
```

El desfase `+02:00` fijo es incorrecto en invierno: convierte `starts_on`/`ends_on` a instantes de `Europe/Madrid` con una función pura `madridDayBounds(date: string): { start: string; end: string }` en `apps/admin/lib/schedule.ts` (usa `Intl.DateTimeFormat` con `timeZone: "Europe/Madrid"` para obtener el desfase de ese día) y pruébala con una fecha de verano (`2026-07-15` → `+02:00`) y una de invierno (`2026-12-24` → `+01:00`). Usa esa función en `addTimeOff`.

`schedules/actions.test.ts`: no propietaria → error de permiso sin llamar a `rpc`; horario con solape → error del validador sin llamar a `rpc`; `rpc` con error `23P01` → "Hay tramos que se solapan el mismo día."; ausencia con fecha final anterior → error sin insertar.

- [ ] **Step 3: Editor**

`schedules/ScheduleEditor.tsx`:

```tsx
"use client";

import { Button } from "@clinicalumia/ui/button";
import { Card } from "@clinicalumia/ui/card";
import { Input } from "@clinicalumia/ui/input";
import { useState, useTransition } from "react";
import { type ScheduleBlock, WEEKDAYS } from "@/lib/schedule";
import { saveSchedule } from "./actions";

type Row = { key: string; starts_at: string; ends_at: string };

function toRows(blocks: ScheduleBlock[]) {
  const rows: Record<number, Row[]> = {};
  for (let day = 1; day <= 7; day++) rows[day] = [];
  for (const block of blocks) {
    rows[block.weekday].push({ key: crypto.randomUUID(), starts_at: block.starts_at.slice(0, 5), ends_at: block.ends_at.slice(0, 5) });
  }
  return rows;
}

export function ScheduleEditor({ profileId, blocks }: { profileId: string; blocks: ScheduleBlock[] }) {
  const [rows, setRows] = useState(() => toRows(blocks));
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ error: string } | { ok: true } | null>(null);

  const update = (day: number, next: Row[]) => {
    setStatus(null);
    setRows((current) => ({ ...current, [day]: next }));
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col divide-y divide-line">
        {WEEKDAYS.map((label, index) => {
          const day = index + 1;
          return (
            <div key={label} data-testid={`schedule-day-${day}`} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
              <span className="w-28 shrink-0 pt-2.5 text-[15px] font-medium text-ink-900">{label}</span>
              <div className="flex flex-1 flex-col gap-2">
                {rows[day].length === 0 && <span className="pt-2.5 text-sm text-ink-800">Sin horario</span>}
                {rows[day].map((row, position) => (
                  <div key={row.key} className="flex flex-wrap items-center gap-2">
                    <Input type="time" aria-label={`${label}, inicio del tramo ${position + 1}`} data-testid="schedule-start" className="w-32" value={row.starts_at}
                      onChange={(event) => update(day, rows[day].map((r) => (r.key === row.key ? { ...r, starts_at: event.target.value } : r)))} />
                    <span className="text-ink-800">a</span>
                    <Input type="time" aria-label={`${label}, fin del tramo ${position + 1}`} data-testid="schedule-end" className="w-32" value={row.ends_at}
                      onChange={(event) => update(day, rows[day].map((r) => (r.key === row.key ? { ...r, ends_at: event.target.value } : r)))} />
                    <Button type="button" variant="ghost" size="sm" data-testid="schedule-remove"
                      onClick={() => update(day, rows[day].filter((r) => r.key !== row.key))}>
                      Quitar
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="secondary" size="sm" data-testid={`schedule-add-${day}`}
                onClick={() => update(day, [...rows[day], { key: crypto.randomUUID(), starts_at: "", ends_at: "" }])}>
                Añadir tramo
              </Button>
            </div>
          );
        })}
      </div>
      {status && "error" in status && <p role="alert" data-testid="schedule-error" className="text-[13px] text-danger-600">{status.error}</p>}
      {status && "ok" in status && <p role="status" data-testid="schedule-saved" className="text-[13px] text-sage-900">Horario guardado.</p>}
      <div>
        <Button type="button" disabled={pending} data-testid="schedule-save"
          onClick={() =>
            startTransition(async () => {
              const blocks = Object.entries(rows).flatMap(([day, list]) =>
                list.map((row) => ({ weekday: Number(day), starts_at: row.starts_at, ends_at: row.ends_at })),
              );
              setStatus(await saveSchedule(profileId, blocks));
            })
          }>
          {pending ? "Guardando…" : "Guardar horario"}
        </Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 4: Ausencias y página**

`schedules/TimeOffForm.tsx` (cliente, `useActionState(addTimeOff)`, `onSubmit` con `startTransition` para no perder lo escrito; campos `Field` «Desde» `type="date" name="starts_on"`, «Hasta» `name="ends_on"`, «Motivo» `name="reason"`; `input type="hidden" name="profile_id"`; error con `role="alert" data-testid="timeoff-error"`; `data-testid="timeoff-form"`; al guardar bien, `form.reset()`).

`schedules/TimeOffRow.tsx` (cliente): muestra «24/12/2026 – 26/12/2026 · Navidad» con fechas formateadas en `es-ES` y zona `Europe/Madrid`, y un `ConfirmDialog` «¿Eliminar esta ausencia?» que llama a `deleteTimeOff`; `data-testid="timeoff-row"`; errores con `role="alert"`.

`schedules/page.tsx` (servidor): lee `searchParams.employee`; carga `profiles` activos (`id, full_name, role`, propietaria incluida, orden por nombre); el seleccionado es el del parámetro o el primero; carga su horario y sus ausencias futuras (`ends_at >= now()`), ordenadas. Renderiza `PageHeader` «Horarios» («Horario semanal de cada persona del equipo y sus ausencias. La agenda solo ofrecerá huecos dentro de estos tramos.»), un selector de persona (formulario GET con `Select name="employee"` y `data-testid="schedule-employee"` que envía al cambiar: componente cliente mínimo `EmployeePicker` que hace `router.push("/schedules?employee=" + id)`), el `ScheduleEditor` con `key={selectedId}`, y una sección «Ausencias» con `TimeOffForm` y la lista de `TimeOffRow` (o «No hay ausencias previstas.»).

`layout.tsx`: añade `{ href: "/schedules", label: "Horarios" }` tras Servicios.

- [ ] **Step 5: Verificar**

Run: `make lint && make typecheck && make test && make test.db && make test.e2e` → Expected: PASS. Captura `/schedules` a 1440 y 390 px (fuera del repo) y comprueba que en el móvil cada día apila sus tramos sin desbordar.

- [ ] **Step 6: Commits**

```bash
git add "apps/admin/app/(admin)/schedules/actions.ts" "apps/admin/app/(admin)/schedules/actions.test.ts" apps/admin/lib/schedule.ts apps/admin/lib/schedule.test.ts
git commit -m "Guardar horarios y ausencias desde el admin"
git add "apps/admin/app/(admin)/schedules" "apps/admin/app/(admin)/layout.tsx" e2e/admin-config.spec.ts
git commit -m "Añadir la pantalla de horarios y ausencias al admin"
```

---

### Task 7: Datos de la clínica en la base de datos

**Files:**
- Create: `packages/db/supabase/migrations/20260926110000_datos_de_la_clinica.sql`, `packages/db/supabase/tests/clinic_settings.test.sql`
- Modify: `seed.sql`, `tests/seed.test.sql`, `types.ts`

**Interfaces:**
- Produces: `public.clinic_settings` (una sola fila, `id boolean primary key default true check (id)`) con `legal_name, tax_id, address_line, postal_code, city, province, phone, email, website, logo_path (nullable), vat_exemption_text, invoice_footer, invoice_prefix, rectifying_prefix, cancellation_hours (0–720, por defecto 24), timezone ('Europe/Madrid'), updated_at`; bucket público `branding` (PNG/JPEG/WebP/SVG, máx. 2 MB) donde solo la propietaria sube o borra.

- [ ] **Step 1: pgTAP que falla**

`clinic_settings.test.sql` (UUIDs `30000000-…`, mismo arranque): existe exactamente una fila tras la migración; una segunda inserción falla (`23505`); la propietaria puede actualizar `legal_name`; una empleada activa puede leer pero su `update` no cambia nada (0 filas; comprueba el valor como `postgres` tras `reset role`); `cancellation_hours = 800` falla (`23514`); la propietaria puede insertar en `storage.objects` con `bucket_id = 'branding'` y una empleada no (`42501`); el bucket existe, es público y limita tamaño y tipos (lee `storage.buckets`).

Run: `make db.reset && make test.db` → Expected: FAIL.

- [ ] **Step 2: Migración**

```sql
create table public.clinic_settings (
  id boolean primary key default true check (id),
  legal_name text not null default '',
  tax_id text not null default '',
  address_line text not null default '',
  postal_code text not null default '',
  city text not null default '',
  province text not null default '',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  logo_path text,
  vat_exemption_text text not null default 'Operación exenta de IVA según el artículo 20.Uno.3º de la Ley 37/1992, del Impuesto sobre el Valor Añadido.',
  invoice_footer text not null default '',
  invoice_prefix text not null default '',
  rectifying_prefix text not null default 'R',
  cancellation_hours integer not null default 24 check (cancellation_hours between 0 and 720),
  timezone text not null default 'Europe/Madrid',
  updated_at timestamptz not null default now()
);

insert into public.clinic_settings (id) values (true);

create trigger clinic_settings_touch
  before update on public.clinic_settings
  for each row execute function public.touch_updated_at();

alter table public.clinic_settings enable row level security;

create policy "clinic_settings_select_active_staff" on public.clinic_settings
  for select to authenticated using (public.is_active_staff());
create policy "clinic_settings_update_owner" on public.clinic_settings
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('branding', 'branding', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "branding_insert_owner" on storage.objects
  for insert to authenticated with check (bucket_id = 'branding' and public.is_owner());
create policy "branding_update_owner" on storage.objects
  for update to authenticated using (bucket_id = 'branding' and public.is_owner()) with check (bucket_id = 'branding' and public.is_owner());
create policy "branding_delete_owner" on storage.objects
  for delete to authenticated using (bucket_id = 'branding' and public.is_owner());
```

Run: `make db.reset && make test.db` → Expected: PASS.

- [ ] **Step 3: Seed y tipos**

```sql
update public.clinic_settings set
  legal_name = 'Patricia Hernán Sánchez',
  tax_id = '20449989E',
  address_line = 'Calle Montesa 7',
  postal_code = '46800',
  city = 'Xàtiva',
  province = 'Valencia',
  phone = '614 552 808',
  email = 'info@clinicalumia.es',
  website = 'https://www.clinicalumia.es',
  cancellation_hours = 24;
```

`seed.test.sql`: `select is((select tax_id from public.clinic_settings), '20449989E', 'the development seed fills in the clinic details');`.

Run: `make db.reset && make test.db && make db.types && make db.types.check` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db
git commit -m "Guardar los datos fiscales, de facturación y el logo de la clínica"
```

---

### Task 8: Validar los datos de la clínica

**Files:**
- Create: `apps/admin/lib/tax-id.ts`, `tax-id.test.ts`, `apps/admin/lib/clinic-settings.ts`, `clinic-settings.test.ts`

**Interfaces:**
- Produces: `normalizeTaxId(input: string): string` (mayúsculas, sin espacios ni guiones ni puntos); `isValidSpanishTaxId(input: string): boolean` (DNI, NIE y CIF con su dígito o letra de control); `type ClinicSettingsInput` con los campos editables; `parseClinicSettings(formData: FormData): { ok: true; settings: ClinicSettingsInput } | { error: string }`.

- [ ] **Step 1: Tests (fallan)**

`tax-id.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isValidSpanishTaxId, normalizeTaxId } from "./tax-id";

describe("Spanish tax ids", () => {
  it("normalises how people type them", () => {
    expect(normalizeTaxId(" 20.449.989-e ")).toBe("20449989E");
  });

  it("accepts a DNI whose control letter matches, like the clinic owner's", () => {
    expect(isValidSpanishTaxId("20449989E")).toBe(true);
    expect(isValidSpanishTaxId("20449989-e")).toBe(true);
  });

  it("rejects a DNI with the wrong letter, which would make invoices invalid", () => {
    expect(isValidSpanishTaxId("20449989A")).toBe(false);
  });

  it("accepts NIE (X/Y/Z) and company CIF numbers with a correct control character", () => {
    expect(isValidSpanishTaxId("X1234567L")).toBe(true);
    expect(isValidSpanishTaxId("B12345674")).toBe(true);
    expect(isValidSpanishTaxId("B12345675")).toBe(false);
  });

  it("rejects anything that is not a tax id", () => {
    expect(isValidSpanishTaxId("")).toBe(false);
    expect(isValidSpanishTaxId("1234")).toBe(false);
  });
});
```

`clinic-settings.test.ts`: datos completos → `settings` con NIF normalizado y `cancellation_hours` numérico; NIF inválido → "El NIF/CIF no es válido. Revisa la letra o el dígito de control."; email inválido → "El email no es válido."; código postal que no es de 5 cifras → "El código postal debe tener 5 cifras."; `cancellation_hours` fuera de 0–720 → error; razón social vacía → "La razón social o nombre del titular es obligatorio."; `website` vacío se acepta y uno sin `https://` se completa con `https://`.

Run: `pnpm --filter admin test` → Expected: FAIL.

- [ ] **Step 2: Implementar**

`tax-id.ts`:

```ts
const DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";
const CIF_LETTERS = "JABCDEFGHI";

export function normalizeTaxId(input: string): string {
  return input.toUpperCase().replace(/[\s.-]/g, "");
}

function dniLetter(digits: string) {
  return DNI_LETTERS[Number(digits) % 23];
}

function validCif(cif: string) {
  const match = /^([ABCDEFGHJKLMNPQRSUVW])(\d{7})([0-9A-J])$/.exec(cif);
  if (!match) return false;
  const [, letter, digits, control] = match;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const n = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = n * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += n;
    }
  }
  const check = (10 - (sum % 10)) % 10;
  if ("PQRSNW".includes(letter)) return control === CIF_LETTERS[check];
  if ("ABEH".includes(letter)) return control === String(check);
  return control === String(check) || control === CIF_LETTERS[check];
}

export function isValidSpanishTaxId(input: string): boolean {
  const id = normalizeTaxId(input);
  const dni = /^(\d{8})([A-Z])$/.exec(id);
  if (dni) return dni[2] === dniLetter(dni[1]);
  const nie = /^([XYZ])(\d{7})([A-Z])$/.exec(id);
  if (nie) return nie[3] === dniLetter(`${"XYZ".indexOf(nie[1])}${nie[2]}`);
  return validCif(id);
}
```

`clinic-settings.ts`: `ClinicSettingsInput = { legal_name, tax_id, address_line, postal_code, city, province, phone, email, website, vat_exemption_text, invoice_footer, invoice_prefix, rectifying_prefix, cancellation_hours }` (todos `string` salvo `cancellation_hours: number`); `parseClinicSettings` recorta textos, valida en el orden de los tests y devuelve `tax_id` normalizado y `website` con `https://` si falta.

Run: `pnpm --filter admin test` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/admin/lib/tax-id.ts apps/admin/lib/tax-id.test.ts apps/admin/lib/clinic-settings.ts apps/admin/lib/clinic-settings.test.ts
git commit -m "Validar el NIF, NIE o CIF y los datos de la clínica"
```

---

### Task 9: Pantalla de datos de la clínica con logo

**Files:**
- Create: `packages/ui/src/components/textarea.tsx`, `apps/admin/app/(admin)/clinic/page.tsx`, `clinic/actions.ts`, `clinic/actions.test.ts`, `clinic/ClinicSettingsForm.tsx`, `clinic/LogoUploader.tsx`, `clinic/InvoiceHeaderPreview.tsx`, `e2e/fixtures/logo.png` (copia de `packages/ui/src/assets/logo-dark.png`)
- Modify: `apps/admin/app/(admin)/layout.tsx`, `apps/admin/next.config.ts`, `e2e/admin-config.spec.ts`

**Interfaces:**
- Consumes: `parseClinicSettings` (Tarea 8); `clinic_settings`, bucket `branding` (Tarea 7).
- Produces: `saveClinicSettings(prev, formData): Promise<{ error: string } | { ok: true } | undefined>`; `uploadLogo(prev, formData): Promise<…>` (valida tipo y tamaño ≤ 2 MB antes de subir; sube como `logo-<timestamp>.<ext>`; actualiza `logo_path`; borra el logo anterior solo tras actualizar bien; si falla la actualización, borra el recién subido); `Textarea` en `@clinicalumia/ui/textarea` que reutiliza `fieldControl` de `Input` con altura automática (`h-auto min-h-24 py-2.5`); `data-testid`: `clinic-form`, `clinic-error`, `clinic-saved`, `logo-input`, `logo-submit`, `logo-error`, `logo-preview`.

- [ ] **Step 1: e2e que falla**

Añade a `e2e/admin-config.spec.ts`:

```ts
test("the owner fixes an invalid tax id, saves the clinic details and uploads the logo shown in the invoice preview", async ({ page }) => {
  const { data: before } = await admin.from("clinic_settings").select("*").single();
  try {
    await loginAsSeedOwner(page);
    await page.goto(`${ADMIN}/clinic`);
    await page.getByLabel("NIF / CIF").fill("20449989A");
    await page.getByTestId("clinic-submit").click();
    await expect(page.getByTestId("clinic-error")).toContainText("El NIF/CIF no es válido");
    await expect(page.getByLabel("Razón social o nombre del titular")).toHaveValue(before!.legal_name);
    await page.getByLabel("NIF / CIF").fill("20449989-e");
    await page.getByLabel("Plazo de cancelación gratuita (horas)").fill("48");
    await page.getByTestId("clinic-submit").click();
    await expect(page.getByTestId("clinic-saved")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("NIF / CIF")).toHaveValue("20449989E");
    await expect(page.getByLabel("Plazo de cancelación gratuita (horas)")).toHaveValue("48");
    await page.getByTestId("logo-input").setInputFiles("fixtures/logo.png");
    await page.getByTestId("logo-submit").click();
    await expect(page.getByTestId("logo-preview").getByRole("img")).toBeVisible();
  } finally {
    const { data: after } = await admin.from("clinic_settings").select("logo_path").single();
    if (after?.logo_path && after.logo_path !== before?.logo_path) {
      await admin.storage.from("branding").remove([after.logo_path]);
    }
    await admin.from("clinic_settings").update({ ...before, updated_at: undefined }).eq("id", true);
  }
});
```

Run: `make test.e2e` → Expected: FAIL.

- [ ] **Step 2: `Textarea`**

`packages/ui/src/components/textarea.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";
import { fieldControl } from "./input";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(fieldControl, "h-auto min-h-24 py-2.5", className)} {...props} />;
}
```

Añade un test en `packages/ui/src/components/field.test.tsx` que compruebe que `Field` conecta su etiqueta con un `Textarea`.

- [ ] **Step 3: Acciones**

`clinic/actions.ts`: `saveClinicSettings` (propietaria → `parseClinicSettings` → `update(...).eq("id", true)`; errores claros; `revalidatePath("/clinic")`; devuelve `{ ok: true }`). `uploadLogo`: propietaria; `const file = formData.get("logo")`; si no es `File` o `size === 0` → "Elige una imagen."; tipo fuera de PNG/JPEG/WebP/SVG → "El logo debe ser PNG, JPG, WebP o SVG."; `size > 2 * 1024 * 1024` → "El logo no puede pesar más de 2 MB."; sube con el cliente del usuario (`supabase.storage.from("branding").upload(path, file, { contentType: file.type })`), actualiza `logo_path`; si falla la actualización, `remove([path])` y error; si va bien y había logo anterior, `remove([anterior])`; `revalidatePath("/clinic")`.

`clinic/actions.test.ts`: no propietaria → error sin tocar almacenamiento; archivo de 3 MB → error sin subir; tipo `image/gif` → error sin subir; fallo al actualizar tras subir → se llama a `remove` con la ruta nueva.

`apps/admin/next.config.ts`: añade `experimental: { serverActions: { bodySizeLimit: "3mb" } }` para que el logo de 2 MB llegue a la acción (el límite por defecto es 1 MB).

- [ ] **Step 4: Pantalla**

`clinic/ClinicSettingsForm.tsx` (cliente, `useActionState(saveClinicSettings)` con `onSubmit` + `startTransition`; `data-testid="clinic-form"`), en tres tarjetas `Card` con encabezado `h2`:
- **Datos fiscales:** «Razón social o nombre del titular» (`legal_name`), «NIF / CIF» (`tax_id`), «Dirección» (`address_line`), «Código postal», «Localidad», «Provincia».
- **Contacto:** «Teléfono», «Email», «Web».
- **Facturas y reservas:** «Prefijo de las facturas» (`invoice_prefix`, hint «Opcional. La numeración será AAAA-0001 precedida de este prefijo.»), «Prefijo de las rectificativas» (`rectifying_prefix`), «Texto de exención de IVA» (`Textarea`), «Pie de factura» (`Textarea`, hint «Por ejemplo, la cuenta para transferencias.»), «Plazo de cancelación gratuita (horas)» (`cancellation_hours`, hint «Se aplica a todos los servicios salvo que un servicio tenga el suyo.»).
Error con `role="alert" data-testid="clinic-error"`, éxito con `role="status" data-testid="clinic-saved"` («Datos guardados.»), botón `data-testid="clinic-submit"` «Guardar datos».

`clinic/LogoUploader.tsx` (cliente, `useActionState(uploadLogo)`): `Field` «Logo» con `<input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-testid="logo-input">` (con la clase de campo), botón `data-testid="logo-submit"` «Subir logo», error `data-testid="logo-error"`.

`clinic/InvoiceHeaderPreview.tsx` (servidor): `Card` `data-testid="logo-preview"` titulada «Vista previa de la cabecera de factura», con el logo (URL pública `supabase.storage.from("branding").getPublicUrl(logo_path)`, `<img alt="Logo de la clínica">`, altura 48px) o el texto «Aún no hay logo», la razón social en negrita, «NIF 20449989E», dirección en una línea y contacto.

`clinic/page.tsx`: `PageHeader` «Datos de la clínica» («Aparecen en las facturas y definen las condiciones de reserva.»); en escritorio, formulario a la izquierda y logo + vista previa a la derecha (`grid lg:grid-cols-[1fr_22rem]`); en móvil, apilado.

`layout.tsx`: añade `{ href: "/clinic", label: "Datos de la clínica" }` al final del menú.

- [ ] **Step 5: Verificar**

Run: `make lint && make typecheck && make test && make test.db && make test.e2e` → Expected: PASS. Captura `/clinic` a 1440 y 390 px.

- [ ] **Step 6: Commits**

```bash
git add packages/ui/src/components/textarea.tsx packages/ui/src/components/field.test.tsx
git commit -m "Añadir el área de texto al sistema de diseño"
git add "apps/admin/app/(admin)/clinic/actions.ts" "apps/admin/app/(admin)/clinic/actions.test.ts" apps/admin/next.config.ts
git commit -m "Guardar los datos de la clínica y subir su logo"
git add "apps/admin/app/(admin)/clinic" "apps/admin/app/(admin)/layout.tsx" e2e
git commit -m "Añadir la pantalla de datos de la clínica al admin"
```

---

### Task 10: Equipo completo con nº de colegiado

**Files:**
- Modify: `apps/admin/app/(admin)/team/page.tsx`, `team/actions.ts`, `team/actions.test.ts`, `team/CreateForm.tsx`, `team/MemberRow.tsx`, `e2e/admin-ui.spec.ts`

**Interfaces:**
- Produces: `createMember` y `updateMember` guardan `license_number` (opcional, recortado, `null` si vacío); la lista incluye a la propietaria, con etiqueta «Propietaria», sin botones de desactivar ni reenviar invitación para ella; `data-testid="member-license"`.

- [ ] **Step 1: Tests (fallan)**

En `team/actions.test.ts`: `updateMember` envía `license_number: "46-12345"` cuando el formulario lo trae y `null` cuando viene vacío. En `e2e/admin-ui.spec.ts`: la propietaria del seed aparece en Equipo con «Propietaria» y sin botón «Desactivar»; editar a «Laura Ejemplo» con nº de colegiado «46-12345» lo muestra en su fila (`member-license`) y se restaura en `afterEach`.

Run: `make test && make test.e2e` → Expected: FAIL.

- [ ] **Step 2: Implementar**

- `team/page.tsx`: quita `.eq("role", "employee")`, selecciona también `role, license_number`, ordena primero la propietaria y luego por nombre.
- `team/actions.ts`: lee `license_number` en `createMember` (en el `insert` del perfil) y en `updateMember` (en el `update`).
- `team/CreateForm.tsx`: añade `Field` «Nº de colegiado» (`name="license_number"`, hint «Opcional. Aparecerá en sus facturas.») en la rejilla (pasa a `sm:grid-cols-2 lg:grid-cols-4`).
- `team/MemberRow.tsx`: modo edición con el mismo campo (`defaultValue={member.license_number ?? ""}`); modo lectura muestra `Nº colegiado …` con `data-testid="member-license"` cuando existe, y `Badge tone="bark"` «Propietaria» para ella; para la propietaria no se muestran «Reenviar invitación» ni «Desactivar».

- [ ] **Step 3: Verificar y commit**

Run: `make lint && make typecheck && make test && make test.e2e` → Expected: PASS.

```bash
git add "apps/admin/app/(admin)/team" e2e/admin-ui.spec.ts
git commit -m "Mostrar a todo el equipo con su nº de colegiado"
```

---

### Task 11: Inicio del admin y pendientes menores

**Files:**
- Modify: `apps/admin/app/(admin)/page.tsx`, `packages/ui/src/components/checkbox-field.tsx`, `checkbox-field.test.tsx`, `packages/ui/src/styles/brand.css`, `scripts/local-env.sh`, `apps/dashboard/package.json`, `e2e/package.json`

**Interfaces:**
- Produces: tarjetas de inicio para las seis secciones; `CheckboxField` combina `aria-describedby` del llamante con el suyo y respeta su `aria-invalid` si no hay error (como `Field`); sin token `line-strong`; la clave de servicio solo en `apps/admin/.env.development.local`; `@supabase/supabase-js` alineado a la versión del resto del monorepo.

- [ ] **Step 1: Test de `CheckboxField` (falla)**

En `checkbox-field.test.tsx`: un `aria-describedby="extra"` del llamante se conserva junto al id del hint.

- [ ] **Step 2: Implementar**

- `CheckboxField`: calcula `describedBy` como `[checkboxProps["aria-describedby"], hint && hintId, error && errorId]`, y pasa `aria-invalid` y `aria-describedby` **después** del spread para que no se pisen.
- `brand.css`: elimina `--color-line-strong` (ya no se usa; comprueba con `grep -rn line-strong packages apps`).
- `scripts/local-env.sh`: escribe `SUPABASE_SERVICE_ROLE_KEY` solo en `apps/admin/.env.development.local`; web y dashboard reciben solo URL y clave anónima.
- `apps/dashboard/package.json` y `e2e/package.json`: `@supabase/supabase-js` a la misma versión que `packages/api` (`pnpm install`).
- `(admin)/page.tsx`: tarjetas para Equipo, Especialidades, Servicios, Horarios y Datos de la clínica, con una frase cada una.

- [ ] **Step 3: Verificar y commits**

Run: `make lint && make typecheck && make test && make test.e2e` → Expected: PASS.

```bash
git add packages/ui/src/components/checkbox-field.tsx packages/ui/src/components/checkbox-field.test.tsx
git commit -m "Combinar las descripciones accesibles del campo de casilla"
git add packages/ui/src/styles/brand.css scripts/local-env.sh apps/dashboard/package.json e2e/package.json pnpm-lock.yaml "apps/admin/app/(admin)/page.tsx"
git commit -m "Actualizar el inicio del admin y cerrar pendientes menores del sistema de diseño"
```

---

## Siguiente

**1d · Publicación y verificación en dos pasos:**
- proyectos de Vercel `panel.` y `admin.` con sus dominios y variables;
- migraciones y configuración de login en producción;
- cuenta de propietaria en producción;
- verificación en dos pasos para el personal.
