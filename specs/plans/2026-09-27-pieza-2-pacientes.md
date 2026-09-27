# Pieza 2 — Pacientes · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ficha única de personas (pacientes y tutores) en el dashboard, con tutela de menores, sin duplicados por DNI y con aviso de coincidencias por email o teléfono. Incluye búsqueda sin acentos, archivar y recuperar, y borrado solo por la propietaria.

**Architecture:** Se construye por capas:
- **Migración:** tablas `people` y `guardianships`. Un trigger normaliza DNI, email y teléfono, y `search_text` se genera sin acentos, con índice trigram. `find_possible_duplicates()` es `security invoker`. RLS: personal activo lee, crea y edita; la propietaria borra. Todo va con pgTAP.
- **Reglas puras** en `apps/dashboard/lib/` con Vitest. La validación de DNI/NIE pasa del admin a `@clinicalumia/api/tax-id` para compartirla.
- **Pantallas** en `apps/dashboard/app/(app)/patients/**` con `@clinicalumia/ui` y acciones de servidor finas. La base de datos es la barrera; las acciones traducen sus errores a mensajes claros.

**Tech Stack:** Supabase (Postgres, `pg_trgm`, `unaccent`, RLS, pgTAP) · Next.js 16 · React 19 · `@clinicalumia/ui` · Vitest · Playwright.

**Spec:** `specs/2026-09-27-pieza-2-pacientes-design.md`; plataforma: `specs/2026-09-25-plataforma-lumia-v1-design.md`.

## Global Constraints

- Todo cambio de base de datos es una migración en `packages/db/supabase/migrations`. Tras cada una, `make db.types` y `make db.types.check` en verde. Nada se aplica en remoto en este plan.
- Permisos:
  - `select`, `insert` y `update` en `people` y `guardianships` con `public.is_active_staff()`;
  - `delete` con `public.is_owner()`.

  Esas funciones ya exigen `aal2` y una sesión viva. Nunca "haber iniciado sesión" sin más.
- Normalización (la misma en la base de datos y en la app):
  - **DNI/NIE:** mayúsculas, sin espacios, puntos ni guiones.
  - **Email:** recortado y en minúsculas.
  - **Teléfono:**
    - se quitan todos los caracteres que no sean dígitos, salvo un `+` inicial;
    - `+34` o `0034` seguidos de 9 dígitos se guardan como esos 9 dígitos;
    - cualquier otro número internacional conserva el `+`.
  - Vacío → `null` en DNI, email y teléfono.
- Menor: menos de 18 años en la fecha de hoy en `Europe/Madrid`. El día del 18.º cumpleaños ya es mayor.
- Datos solo inventados (seed local y e2e). Los e2e crean sus propias personas con nombres únicos y las borran al terminar con el cliente de servicio; nunca modifican las del seed ni hacen `db reset`.
- Textos en español; sin comentarios en el código; tests con `data-testid` > rol > etiqueta; commits pequeños con título descriptivo en español, sin cuerpo ni prefijos; nunca `--no-verify`.
- Gates antes de cada commit:
  - siempre: `make lint` (0 avisos; si falla solo por worktrees anidados en `.claude/`, pasa biome sobre `apps packages e2e scripts` y dilo), `make typecheck`, `make test`, `make test.db`;
  - en las tareas con pantallas, además `make test.e2e` dos veces, con los workers por defecto.
- Docker: `export PATH="$HOME/.orbstack/bin:$PATH"`. Supabase local se arranca desde **este worktree** durante el plan (las migraciones nuevas viven aquí); el controlador lo devuelve a la carpeta principal tras fusionar. Si un comando de Docker tarda más de 2 minutos, parar e informar.

## Review Focus

1. **El mismo teléfono escrito de formas distintas** ("614 55 28 08", "+34 614552808", "0034-614-552-808") se detecta como el mismo al avisar de duplicados. Tests en las Tareas 2 y 4.
2. **Un DNI repetido con otro formato** ("12.345.678-z" frente a "12345678Z") lo rechaza la base de datos con un mensaje claro, no con un error genérico. Tests en las Tareas 2 y 6.
3. **Una persona tutora de sí misma, dos tutores principales o un tutor menor de edad**: se rechazan con mensajes claros. Tests en las Tareas 2 y 7.
4. **Borrar a un tutor que tiene menores a su cargo**, o borrar siendo empleada, no deja datos a medias y explica por qué no se puede. Tests en las Tareas 2 y 7.
5. **Buscar "garcia" encuentra "García"**, y buscar "614 55" encuentra "614552808". Tests en las Tareas 2 y 5.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/api/tax-id.ts` (+ test) | Validación de DNI/NIE/CIF compartida; se mueve desde `apps/admin/lib/` (mover). |
| `packages/db/supabase/migrations/20260927110000_personas_y_tutela.sql` | `people`, `guardianships`, normalización, búsqueda y RLS (crear). |
| `packages/db/supabase/migrations/20260927120000_posibles_duplicados.sql` | `find_possible_duplicates()` (crear). |
| `packages/db/supabase/tests/people.test.sql` | pgTAP (crear). |
| `packages/db/supabase/seed.sql`, `tests/seed.test.sql` | Familia de ejemplo (modificar). |
| `apps/dashboard/lib/person.ts` (+ test) | `normalizePhone`, `normalizeSearch`, `isMinor`, `ageOn`, `parsePersonForm` (crear). |
| `apps/dashboard/lib/action-result.ts` | `ActionResult` (crear, igual que en el admin). |
| `apps/dashboard/app/(app)/patients/**` | Listado, alta, ficha y edición (crear). |
| `apps/dashboard/app/(app)/layout.tsx` | Menú: Inicio, Pacientes (modificar). |
| `e2e/patients.spec.ts` | Recorridos (crear). |

---

### Task 1: Compartir la validación de DNI/NIE/CIF

**Files:**
- Move: `apps/admin/lib/tax-id.ts` → `packages/api/tax-id.ts`, y `apps/admin/lib/tax-id.test.ts` → `packages/api/tax-id.test.ts`
- Modify: `packages/api/package.json` (export `"./tax-id": "./tax-id.ts"`), `apps/admin/lib/clinic-settings.ts` (import desde `@clinicalumia/api/tax-id`)

**Interfaces:**
- Produces: `@clinicalumia/api/tax-id` con `normalizeTaxId(input: string): string` e `isValidSpanishTaxId(input: string): boolean`, sin cambios de comportamiento.

- [ ] **Step 1:** mueve los dos archivos con `git mv`, añade el export y cambia el import del admin. Esto es una refactorización: no se toca la lógica ni los tests, solo su ruta.
- [ ] **Step 2:** Run: `make typecheck && make test` → Expected: PASS, con los mismos tests de DNI que antes, ahora en `packages/api`.
- [ ] **Step 3: Commit**

```bash
git add -A apps/admin/lib packages/api
git commit -m "Compartir la validación del NIF entre el admin y el dashboard"
```

---

### Task 2: Personas y tutela en la base de datos

**Files:**
- Create: `packages/db/supabase/migrations/20260927110000_personas_y_tutela.sql`, `packages/db/supabase/tests/people.test.sql`
- Modify: `packages/db/types.ts` (regenerado)

**Interfaces:**
- Produces:
  - `public.people`, con las columnas de la spec, sección 3;
  - `public.guardianships(minor_id, guardian_id, relationship public.guardian_relationship, is_primary)`;
  - `public.f_unaccent(text)` (inmutable);
  - `public.normalize_phone(text)` (inmutable);
  - los códigos de error `23505` (DNI repetido; segundo tutor principal), `23514` (tutor de sí mismo; nombre vacío; fecha futura) y `23503` (borrar a un tutor con menores).

- [ ] **Step 1: pgTAP que falla**

`people.test.sql` usa el arranque de `mfa.test.sql`: el helper `act_as`, que crea una sesión real y pone `aal2` y `session_id` en los claims. Hay una propietaria, una empleada activa y una empleada inactiva, con UUIDs `50000000-…`. Aserciones, cada una con un mensaje que diga por qué importa:

- **La empleada:**
  - inserta una persona adulta;
  - la lee;
  - la actualiza;
  - su `delete` no borra nada: 0 filas, comprobado como `postgres`.
- **La propietaria** borra una persona sin tutela.
- **La empleada inactiva** ve 0 personas.
- **Normalización:**
  - insertar `tax_id = ' 12.345.678-z '` guarda `12345678Z`;
  - insertar otra persona con `12345678Z` lanza `23505`;
  - `email = ' Ana@Example.COM '` se guarda como `ana@example.com`;
  - `phone = '+34 614 55 28 08'` y `phone = '0034-614-552-808'` se guardan como `614552808`;
  - `phone = '+44 20 7946 0958'` se guarda como `+442079460958`;
  - DNI, email o teléfono vacíos se guardan como `null`.
- **Datos obligatorios:**
  - `first_name = '  '` lanza `23514`;
  - `birth_date` en el futuro lanza `23514`;
  - una persona con `is_patient = true` sin `birth_date` lanza `23514`.
- **Búsqueda:** `search_text` de "María García", DNI `12345678Z` y teléfono `614552808` contiene `maria garcia`, `12345678z` y `614552808`. Una búsqueda `search_text ilike '%garcia%'` la encuentra.
- **Tutela:**
  - tutor de sí mismo lanza `23514`;
  - un segundo `is_primary = true` para el mismo menor lanza `23505`;
  - borrar (como propietaria) a una tutora con un menor a su cargo lanza `23503`;
  - borrar al menor borra su tutela en cascada.

Run: `make db.reset && make test.db` → Expected: FAIL (`relation "public.people" does not exist`).

- [ ] **Step 2: Migración**

```sql
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create or replace function public.f_unaccent(value text)
returns text
language sql
immutable
parallel safe
strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, value);
$$;

create or replace function public.normalize_phone(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when cleaned = '' then null
    when cleaned ~ '^(\+34|0034)[0-9]{9}$' then right(cleaned, 9)
    else cleaned
  end
  from (
    select regexp_replace(
      regexp_replace(coalesce(value, ''), '[^0-9+]', '', 'g'),
      '(?!^)\+', '', 'g'
    ) as cleaned
  ) as normalized;
$$;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  first_name text not null check (length(trim(first_name)) > 0),
  last_name text not null check (length(trim(last_name)) > 0),
  birth_date date check (birth_date <= current_date),
  tax_id text,
  email text,
  phone text,
  address text not null default '',
  admin_notes text not null default '',
  is_patient boolean not null default true,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_text text generated always as (
    lower(public.f_unaccent(
      first_name || ' ' || last_name || ' ' ||
      coalesce(tax_id, '') || ' ' || coalesce(email, '') || ' ' || coalesce(phone, '')
    ))
  ) stored,
  constraint people_patient_needs_birth_date check (not is_patient or birth_date is not null)
);

create unique index people_tax_id_key on public.people(tax_id) where tax_id is not null;
create index people_email_idx on public.people(email);
create index people_phone_idx on public.people(phone);
create index people_search_idx on public.people using gin (search_text extensions.gin_trgm_ops);

create or replace function public.normalize_person()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.first_name := trim(new.first_name);
  new.last_name := trim(new.last_name);
  new.tax_id := nullif(upper(regexp_replace(coalesce(new.tax_id, ''), '[\s.\-]', '', 'g')), '');
  new.email := nullif(lower(trim(coalesce(new.email, ''))), '');
  new.phone := public.normalize_phone(new.phone);
  return new;
end;
$$;

create trigger people_normalize
  before insert or update on public.people
  for each row execute function public.normalize_person();

create trigger people_touch
  before update on public.people
  for each row execute function public.touch_updated_at();

create type public.guardian_relationship as enum ('madre', 'padre', 'tutor_legal', 'otro');

create table public.guardianships (
  minor_id uuid not null references public.people(id) on delete cascade,
  guardian_id uuid not null references public.people(id) on delete restrict,
  relationship public.guardian_relationship not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (minor_id, guardian_id),
  check (minor_id <> guardian_id)
);

create index guardianships_guardian_idx on public.guardianships(guardian_id);
create unique index guardianships_one_primary on public.guardianships(minor_id) where is_primary;

alter table public.people enable row level security;
alter table public.guardianships enable row level security;

create policy "people_select_active_staff" on public.people
  for select to authenticated using (public.is_active_staff());
create policy "people_insert_active_staff" on public.people
  for insert to authenticated with check (public.is_active_staff());
create policy "people_update_active_staff" on public.people
  for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
create policy "people_delete_owner" on public.people
  for delete to authenticated using (public.is_owner());

create policy "guardianships_select_active_staff" on public.guardianships
  for select to authenticated using (public.is_active_staff());
create policy "guardianships_insert_active_staff" on public.guardianships
  for insert to authenticated with check (public.is_active_staff());
create policy "guardianships_update_active_staff" on public.guardianships
  for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
create policy "guardianships_delete_active_staff" on public.guardianships
  for delete to authenticated using (public.is_active_staff());
```

Si alguna expresión regular no se comporta igual en Postgres, ajústala hasta que pasen los tests del Step 1; los tests mandan. Por ejemplo, el lookahead `(?!^)` para quitar los `+` que no están al principio.

Quitar un tutor (borrar la fila de `guardianships`) está permitido al personal activo. Borrar **personas** es solo de la propietaria.

Run: `make db.reset && make test.db && make db.types && make db.types.check` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/db
git commit -m "Guardar personas y tutelas con datos normalizados y búsqueda sin acentos"
```

---

### Task 3: Posibles duplicados y datos de ejemplo

**Files:**
- Create: `packages/db/supabase/migrations/20260927120000_posibles_duplicados.sql`
- Modify: `packages/db/supabase/tests/people.test.sql`, `packages/db/supabase/seed.sql`, `packages/db/supabase/tests/seed.test.sql`, `packages/db/types.ts`

**Interfaces:**
- Produces: `public.find_possible_duplicates(p_tax_id text, p_email text, p_phone text, p_exclude uuid default null) returns table (id uuid, first_name text, last_name text, matched text[], minors text[])`, `security invoker`. Normaliza los parámetros igual que el trigger. Devuelve solo personas no archivadas. `matched` contiene `'tax_id'`, `'email'` y/o `'phone'`. `minors` son los nombres completos de los menores de los que la persona es tutora.

- [ ] **Step 1: pgTAP que falla** (añade a `people.test.sql` y sube `plan`):
  - con una persona de teléfono `614552808`, buscar `'+34 614 55 28 08'` la devuelve con `matched = {phone}`;
  - por email con mayúsculas la devuelve con `{email}`;
  - por DNI con puntos la devuelve con `{tax_id}`;
  - si coinciden dos campos, `matched` tiene los dos;
  - una persona archivada no aparece;
  - `p_exclude` excluye a la propia persona;
  - una tutora devuelve el nombre de su menor en `minors`;
  - una empleada inactiva recibe 0 filas (RLS);
  - con todos los parámetros vacíos devuelve 0 filas.
- [ ] **Step 2: Migración**

```sql
create or replace function public.find_possible_duplicates(
  p_tax_id text,
  p_email text,
  p_phone text,
  p_exclude uuid default null
)
returns table (id uuid, first_name text, last_name text, matched text[], minors text[])
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select
      nullif(upper(regexp_replace(coalesce(p_tax_id, ''), '[\s.\-]', '', 'g')), '') as tax_id,
      nullif(lower(trim(coalesce(p_email, ''))), '') as email,
      public.normalize_phone(p_phone) as phone
  )
  select
    p.id,
    p.first_name,
    p.last_name,
    array_remove(array[
      case when p.tax_id = i.tax_id then 'tax_id' end,
      case when p.email = i.email then 'email' end,
      case when p.phone = i.phone then 'phone' end
    ], null) as matched,
    coalesce((
      select array_agg(m.first_name || ' ' || m.last_name order by m.first_name)
      from public.guardianships g
      join public.people m on m.id = g.minor_id
      where g.guardian_id = p.id
    ), '{}') as minors
  from public.people p, input i
  where p.archived_at is null
    and (p_exclude is null or p.id <> p_exclude)
    and (p.tax_id = i.tax_id or p.email = i.email or p.phone = i.phone)
  order by p.last_name, p.first_name;
$$;

grant execute on function public.find_possible_duplicates(text, text, text, uuid) to authenticated;
```

- [ ] **Step 3: Seed.** Añade a `seed.sql` una familia inventada con UUIDs fijos `a0000000-…-0000000006xx`:
  - Lucía Martínez Soler: tutora, no paciente, teléfono `600111222`, email `lucia.martinez@example.com`.
  - Pablo Ferrer Martínez: 7 años, paciente.
  - Nora Ferrer Martínez: 12 años, paciente.
  - Lucía es tutora principal (`madre`) de los dos.
  - Dos adultos pacientes: Jorge Ruiz Pérez, con DNI válido inventado y comprobado con `isValidSpanishTaxId`; y Elena Gómez Díaz, sin DNI.

  En `seed.test.sql`: 5 personas y 2 tutelas, con el porqué ("la ficha y el aviso de duplicados tienen datos realistas en local").
- [ ] **Step 4:** Run: `make db.reset && make test.db && make db.types && make db.types.check` → Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add packages/db
git commit -m "Buscar posibles duplicados y sembrar una familia de ejemplo"
```

---

### Task 4: Reglas de la ficha

**Files:**
- Create: `apps/dashboard/lib/person.ts`, `apps/dashboard/lib/person.test.ts`, `apps/dashboard/lib/action-result.ts`

**Interfaces:**
- Produces:
  - `normalizePhone(input: string): string | null`: misma regla que la base de datos.
  - `normalizeSearch(input: string): string`: minúsculas, sin acentos (`normalize("NFD")` y quitar marcas). Si la búsqueda solo tiene dígitos, espacios, guiones y `+`, se aplica también `normalizePhone`; si queda vacía, `""`.
  - `ageOn(birthDate: string, today: string): number` y `isMinor(birthDate: string, today: string): boolean`, con fechas `YYYY-MM-DD`.
  - `todayInMadrid(now?: Date): string`.
  - `type PersonInput = { first_name: string; last_name: string; birth_date: string | null; tax_id: string | null; email: string | null; phone: string | null; address: string; admin_notes: string; is_patient: boolean }`.
  - `parsePersonForm(formData: FormData, today: string): { ok: true; person: PersonInput } | { error: string }`.
  - `ActionResult`, igual que en el admin.

- [ ] **Step 1: Tests que fallan (Vitest)**
  - **`normalizePhone`:** los casos de la Global Constraint; `""` da `null`; `"+44 20 7946 0958"` da `"+442079460958"`.
  - **`normalizeSearch`:** `"García"` da `"garcia"`; `"614 55"` da `"61455"`; `"  Ana  "` da `"ana"`.
  - **`ageOn` e `isMinor`:**
    - el día antes del 18.º cumpleaños es menor;
    - el mismo día ya no;
    - un nacimiento el 29 de febrero cumple el 1 de marzo en años no bisiestos.
  - **`todayInMadrid`:** `2026-12-31T23:30:00Z` da `2027-01-01`.
  - **`parsePersonForm`:**
    - nombre vacío: "El nombre es obligatorio.";
    - apellidos vacíos: "Los apellidos son obligatorios.";
    - paciente sin fecha: "La fecha de nacimiento es obligatoria para un paciente.";
    - fecha futura: "La fecha de nacimiento no puede ser futura.";
    - DNI con letra mal: "El DNI/NIE no es válido. Revisa la letra.";
    - email sin arroba: "El email no es válido.";
    - teléfono con menos de 9 dígitos: "El teléfono no es válido.";
    - un tutor (no paciente) sin fecha es válido;
    - la salida va normalizada (DNI en mayúsculas, email en minúsculas, teléfono en 9 dígitos).
- [ ] **Step 2: Implementar.** Usa `isValidSpanishTaxId`/`normalizeTaxId` de `@clinicalumia/api/tax-id`. Añade `@clinicalumia/api` a las dependencias del dashboard si aún no lo tiene para ese export. Run: `pnpm --filter dashboard test` → PASS.
- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib apps/dashboard/package.json pnpm-lock.yaml
git commit -m "Validar la ficha de persona y calcular la edad en hora de Madrid"
```

---

### Task 5: Listado y búsqueda de pacientes

**Files:**
- Create: `apps/dashboard/app/(app)/patients/page.tsx`, `patients/SearchBox.tsx`, `e2e/patients.spec.ts`
- Modify: `apps/dashboard/app/(app)/layout.tsx`

**Interfaces:**
- Consumes: `normalizeSearch`, `ageOn`, `isMinor`, `todayInMadrid` (Tarea 4).
- Produces:
  - `/patients?q=…&archived=1`;
  - menú "Inicio · Pacientes";
  - `data-testid`: `patients-search`, `patients-archived`, `patient-row`, `patient-minor`, `patients-empty`, `patient-new`.

- [ ] **Step 1: e2e que falla** (`e2e/patients.spec.ts`)
  - Entra como `psicologia@lumia.test` con `signIn` de `e2e/auth.ts` en el dashboard.
  - Buscar `martinez` muestra a "Lucía Martínez Soler" y a sus hijos. Nora sale con la etiqueta "Menor".
  - Buscar `600 111` encuentra a Lucía por su teléfono.
  - Una búsqueda sin resultados muestra `patients-empty`.

  Run: `make test.e2e` → FAIL.
- [ ] **Step 2: Implementar**
  - **`page.tsx`** (servidor):
    - lee `q` y `archived`;
    - consulta `people` ordenada por apellidos y nombre, limitada a 50;
    - filtra por `archived_at` (nulo o no) y, si hay `q`, por `.ilike("search_text", "%" + normalizeSearch(q) + "%")`;
    - pinta `PageHeader` "Pacientes" con el botón "Nueva persona" y la tabla, que muestra nombre, edad, teléfono, "Menor" y "Tutora/Tutor" si no es paciente;
    - en móvil las filas se apilan sin desbordar.
  - **`SearchBox.tsx`** (cliente): campo con etiqueta "Buscar por nombre, DNI, teléfono o email" y la casilla "Ver archivados". Actualiza la URL con `router.replace` tras 300 ms sin teclear.
  - **Layout:** añade `{ href: "/patients", label: "Pacientes" }`.
- [ ] **Step 3: Verificar:** gates y `make test.e2e` dos veces; captura a 390 px en el scratchpad sin desbordamiento.
- [ ] **Step 4: Commit**

```bash
git add "apps/dashboard/app/(app)" e2e/patients.spec.ts
git commit -m "Añadir el listado y la búsqueda de pacientes al dashboard"
```

---

### Task 6: Alta y edición con aviso de duplicados

**Files:**
- Create:
  - en `apps/dashboard/app/(app)/patients/`: `actions.ts`, `actions.test.ts`, `PersonForm.tsx`, `DuplicateWarning.tsx`, `new/page.tsx`, `[id]/edit/page.tsx`;
  - `e2e/patients.spec.ts` (ampliar).

**Interfaces:**
- Produces:
  - `savePerson(prev, formData)` crea o actualiza según el campo oculto `id` y termina con `redirect("/patients/<id>")`. Traduce los errores:
    - `23505` en `people_tax_id_key`: "Ya existe una persona con ese DNI/NIE.";
    - `23514`: "Revisa los datos: hay un campo no válido.";
    - `42501` o ninguna fila afectada: "No tienes permiso para hacer esto.";
    - cualquier otro: "No se ha podido guardar.".
  - `checkDuplicates(input: { tax_id: string; email: string; phone: string; exclude?: string }): Promise<Duplicate[]>` llama a `find_possible_duplicates`.
  - `data-testid`: `person-form`, `person-error`, `person-submit`, `duplicate-warning`, `duplicate-use`, `duplicate-continue`.

- [ ] **Step 1: Tests que fallan**
  - **Unitarios** (mocks al estilo de `apps/dashboard/app/login/actions.test.ts`):
    - un formulario inválido no toca la base de datos;
    - `23505` con DNI da el mensaje del DNI;
    - una edición que no afecta filas da el mensaje de permiso;
    - `checkDuplicates` pasa los parámetros tal cual a la RPC y devuelve `[]` si falla (el aviso es una ayuda, no una barrera; el DNI único sí lo es).
  - **e2e:**
    1. Alta de un adulto con nombre único → lleva a su ficha.
    2. Alta con el teléfono `+34 600 111 222` (el de Lucía) → sale `duplicate-warning` con "Lucía Martínez Soler · madre de Nora Ferrer Martínez, Pablo Ferrer Martínez" → `duplicate-use` lleva a la ficha de Lucía sin crear nada.
    3. Alta con el DNI del seed escrito con puntos y minúscula → error "Ya existe una persona con ese DNI/NIE." y los campos conservan lo escrito.
    4. Editar la dirección de una persona creada por el test la guarda.

    El test borra lo que crea.
- [ ] **Step 2: Implementar**
  - **`PersonForm`** (cliente): `useActionState` con `onSubmit` + `startTransition`, como el resto.
    - Campos: Nombre, Apellidos, Fecha de nacimiento, "Es paciente" (casilla, marcada por defecto), DNI/NIE, Email, Teléfono, Dirección, Notas administrativas (`Textarea`).
    - Al salir de DNI, email o teléfono con algún valor, llama a `checkDuplicates` (excluyendo el propio `id` al editar) y pinta `DuplicateWarning` si hay coincidencias.
    - Con el aviso visible, el primer "Guardar" pide elegir: "Usar esta persona" (navega a su ficha) o "Es otra persona, continuar" (quita el aviso y deja guardar).
  - **Páginas:** `new/page.tsx` pinta el formulario vacío y `[id]/edit/page.tsx` con los datos, o `notFound()`.
- [ ] **Step 3: Verificar:** gates y `make test.e2e` dos veces.
- [ ] **Step 4: Commits**

```bash
git add "apps/dashboard/app/(app)/patients/actions.ts" "apps/dashboard/app/(app)/patients/actions.test.ts"
git commit -m "Guardar personas y consultar posibles duplicados desde el dashboard"
git add "apps/dashboard/app/(app)/patients" e2e/patients.spec.ts
git commit -m "Dar de alta y editar personas avisando de posibles duplicados"
```

---

### Task 7: Ficha con tutores, archivar y borrar

**Files:**
- Create: `apps/dashboard/app/(app)/patients/[id]/page.tsx`, `[id]/GuardiansSection.tsx`, `[id]/AddGuardian.tsx`, `[id]/PersonActions.tsx`
- Modify: `patients/actions.ts`, `patients/actions.test.ts`, `e2e/patients.spec.ts`

**Interfaces:**
- Produces acciones que devuelven `ActionResult`:
  - `addGuardian(minorId, guardianId, relationship, isPrimary)`:
    - rechaza, antes de tocar la base de datos, a un tutor menor de edad con "Un tutor tiene que ser mayor de edad." y a la propia persona con "Una persona no puede ser su propio tutor.";
    - traduce `23505` a "Ya tiene un tutor principal." (índice parcial) o a "Ya es tutor de este menor." (clave primaria).
  - `removeGuardian(minorId, guardianId)`.
  - `setArchived(id, archived)`.
  - `deletePerson(id)`:
    - `.delete().eq("id", id).select("id")`;
    - 0 filas da "Solo la propietaria puede eliminar personas.";
    - `23503` da "No se puede eliminar: tiene menores a su cargo.";
    - si va bien, `redirect("/patients")`.
- Pantalla:
  - encabezado con nombre, edad, "Menor" y "Menor sin tutor" (`patient-no-guardian`) si procede;
  - datos, notas y una sección "Tutores" (`guardian-row`) o "A su cargo" (`ward-row`);
  - `AddGuardian` busca personas existentes (reutiliza `normalizeSearch`) o enlaza a "Nueva persona" con `?guardianOf=<id>`: tras crearla, vuelve a la ficha del menor con el tutor añadido;
  - historial vacío: "Aquí aparecerán sus citas, cobros y facturas.";
  - `PersonActions`: Editar, Archivar/Recuperar y Eliminar. Eliminar solo se muestra a la propietaria y va con `ConfirmDialog`.
  - `data-testid`: `guardian-add`, `guardian-search`, `guardian-option`, `guardian-relationship`, `guardian-primary`, `guardian-save`, `guardian-remove`, `person-archive`, `person-delete`, `person-action-error`.

- [ ] **Step 1: Tests que fallan**
  - **Unitarios:**
    - los mensajes de cada error de `addGuardian`;
    - `deletePerson` con 0 filas da el mensaje de la propietaria, y con `23503` el de menores;
    - `setArchived` escribe `archived_at` o `null`.
  - **e2e** (datos creados por el test y borrados al final):
    - crear un menor paciente → la ficha muestra "Menor sin tutor";
    - "Añadir tutor" → crear a su madre desde `guardianOf` → vuelve a la ficha del menor con "madre" como principal, y la ficha de la madre lo muestra en "A su cargo";
    - intentar añadir al propio menor como tutor muestra el error;
    - archivar al menor lo quita del listado, "Ver archivados" lo muestra y "Recuperar" lo devuelve;
    - la empleada no ve "Eliminar";
    - una propietaria de usar y tirar, creada como en `e2e/admin-config.spec.ts`, no puede eliminar a la madre (tiene menores a su cargo) y sí puede eliminar al menor.
- [ ] **Step 2: Implementar y verificar:** gates y `make test.e2e` dos veces; captura de la ficha a 390 px.
- [ ] **Step 3: Commits**

```bash
git add "apps/dashboard/app/(app)/patients/actions.ts" "apps/dashboard/app/(app)/patients/actions.test.ts"
git commit -m "Gestionar tutores, archivar y eliminar personas desde el dashboard"
git add "apps/dashboard/app/(app)/patients" e2e/patients.spec.ts
git commit -m "Añadir la ficha de paciente con tutores e historial al dashboard"
```

---

## Siguiente

Pieza 3 (agenda y reservas), sobre `people` y los horarios de la pieza 1c. Antes de guardar pacientes reales, hay que publicar (Parte B de la pieza 1d) y revisar la región de Supabase y el RGPD.
