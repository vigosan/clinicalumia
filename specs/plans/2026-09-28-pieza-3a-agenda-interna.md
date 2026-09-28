# Pieza 3a — Agenda interna · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agenda del dashboard con citas una a una. Cada profesional gestiona las suyas y ve a sus compañeros como "Ocupado"; la propietaria gestiona todas. Sin solapes, avisos fuera de horario o en ausencia, cancelar, "no se presentó", historial de cada cita, y citas en la ficha del paciente.

**Architecture:**
- **Base de datos:**
  - tablas `appointments` y `appointment_events`;
  - triggers que fijan autor y precio, validan transiciones de estado y escriben el historial;
  - exclusión GiST contra solapes;
  - RLS "propias o propietaria";
  - `agenda_busy()` (`security definer`) que solo devuelve profesional, inicio y fin.
- **Reglas puras:** en `@clinicalumia/api/madrid-time` (horas en Madrid, compartidas) y `apps/dashboard/lib/agenda.ts`, con Vitest.
- **Pantallas:** en `apps/dashboard/app/(app)/`, con `@clinicalumia/ui`. La agenda es la portada `/`.

**Tech Stack:** Supabase (Postgres, `btree_gist`, RLS, pgTAP) · Next.js 16 · React 19 · `@clinicalumia/ui` · Vitest · Playwright.

**Spec:** `specs/2026-09-28-pieza-3a-agenda-interna-design.md`; plataforma: `specs/2026-09-25-plataforma-lumia-v1-design.md`.

## Global Constraints

- Todo cambio de base de datos es una migración en `packages/db/supabase/migrations`, con `make db.types` y `make db.types.check` en verde. Nada se aplica en remoto en este plan.
- **Visibilidad** (se aplica en la base de datos):
  - citas y su historial: `public.is_owner() or (public.is_active_staff() and professional_id = auth.uid())`;
  - de los compañeros, solo `agenda_busy()` (profesional, inicio y fin);
  - ninguna cita se borra.
- **Estados:**
  - `scheduled` → `cancelled` (con `cancelled_by` `patient`/`clinic`; `cancelled_at` lo fija la base de datos) o → `no_show` (solo si `starts_at <= now()`);
  - `no_show` → `scheduled` para corregir un error;
  - `cancelled` es final.
- **Mover:** solo citas `scheduled` cuyo inicio aún no ha pasado. Profesional, paciente y servicio no cambian.
- **Duración:** de 5 a 480 minutos, en múltiplos de 5.
- **Horas:** siempre en `Europe/Madrid`. Se guardan como `timestamptz`.
- **Datos:** solo inventados. Los e2e crean y borran sus citas (y usan pacientes propios o del seed sin modificarlos), no hacen `db reset` y deben funcionar en paralelo: cada test usa franjas horarias propias, días futuros distintos por test, o un profesional de usar y tirar.
- **Reglas de la casa:**
  - textos en español;
  - sin comentarios en el código;
  - tests con `data-testid` > rol > etiqueta;
  - commits pequeños con título descriptivo en español, sin cuerpo;
  - nunca `--no-verify`.
- **Gates:**
  - siempre: `make lint` (0 avisos; si falla solo por worktrees anidados en `.claude/`, pasa biome sobre `apps packages e2e scripts` y dilo), `make typecheck`, `make test` y `make test.db`;
  - en tareas con pantallas, además `make test.e2e` dos veces con los workers por defecto.
- **Supabase local** sigue arrancado desde la carpeta principal; `make db.reset` desde el worktree aplica las migraciones del worktree. No parar ni arrancar Supabase. Docker: si un comando tarda más de 2 minutos, parar e informar.

## Review Focus

1. **Un empleado no puede leer, crear ni cambiar citas de otro**, ni llamando a la API directamente con otro `professional_id`, y `agenda_busy` nunca devuelve paciente ni servicio. Tests en las Tareas 2 y 3.
2. **Dos citas del mismo profesional que se tocan en el límite** (una termina a las 17:00 y otra empieza a las 17:00) están permitidas; una que empieza a las 16:55, no. Tests en las Tareas 2 y 7.
3. **Días de cambio de hora:** una cita a las 10:00 del 29 de marzo o del 25 de octubre se guarda y se muestra a las 10:00 de Madrid, y la semana que contiene ese día tiene sus siete días. Tests en las Tareas 1 y 4.
4. **Estados imposibles:** "no se presentó" en una cita futura, reprogramar una cancelada o mover una pasada se rechazan con un mensaje claro. Tests en las Tareas 2 y 8.
5. **Doble clic o doble envío** al dar, mover o cancelar no crea dos citas ni dos eventos. Tests en las Tareas 7 y 8.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/api/madrid-time.ts` (+ test) | `todayInMadrid`, `madridDayBounds` (movidos) y funciones nuevas de hora (crear y mover). |
| `packages/db/supabase/migrations/20260928090000_citas.sql` | `appointments`, `appointment_events`, triggers y RLS (crear). |
| `packages/db/supabase/migrations/20260928100000_agenda_ocupada.sql` | `agenda_busy()` (crear). |
| `packages/db/supabase/tests/appointments.test.sql` | pgTAP (crear). |
| `packages/db/supabase/seed.sql`, `tests/seed.test.sql` | Citas de ejemplo (modificar). |
| `apps/dashboard/lib/agenda.ts` (+ test) | Avisos, disposición, formulario y transiciones (crear). |
| `apps/dashboard/app/(app)/page.tsx` y `(app)/agenda/**` | Agenda de día y semana, y panel de la cita (crear o reemplazar). |
| `apps/dashboard/app/(app)/appointments/**` | Nueva cita y acciones (crear). |
| `apps/dashboard/app/(app)/patients/[id]/page.tsx` | Historial de citas en la ficha (modificar). |
| `apps/dashboard/app/(app)/layout.tsx` | Menú: Agenda · Pacientes (modificar). |
| `e2e/agenda.spec.ts` | Recorridos (crear). |

---

### Task 1: Horas de Madrid compartidas

**Files:**
- Create: `packages/api/madrid-time.ts`, `packages/api/madrid-time.test.ts`
- Modify:
  - `packages/api/package.json`: export `"./madrid-time": "./madrid-time.ts"`, y en `files` si existe;
  - `apps/admin/lib/schedule.ts` (y su test): importa `madridDayBounds` del paquete;
  - `apps/dashboard/lib/person.ts` (y su test): importa `todayInMadrid` del paquete.

**Interfaces:**
- Produces, en `@clinicalumia/api/madrid-time`:
  - `todayInMadrid(now?: Date): string` y `madridDayBounds(date: string): { start: string; end: string }`: movidas, sin cambios de comportamiento; sus tests se mueven con ellas;
  - nuevas:
    - `madridInstant(date: string, time: string): string` devuelve un ISO con el desfase correcto de Madrid para esa fecha y hora (`"2026-03-29", "10:00"` → `"2026-03-29T10:00:00+02:00"`);
    - `madridDateTime(instant: string | Date): { date: string; time: string }` hace la conversión inversa, con `time` `HH:MM`;
    - `addDays(date: string, days: number): string`;
    - `weekStart(date: string): string` devuelve el lunes de esa semana;
    - `weekdayOf(date: string): number` devuelve 1 = lunes … 7 = domingo.

- [ ] **Step 1: mover.** `git mv` no sirve porque las funciones están dentro de archivos más grandes. Mueve el código y sus tests a `packages/api/madrid-time.ts` y cambia los imports. Run: `make typecheck && make test` → PASS, con el mismo número de tests.
- [ ] **Step 2: tests que fallan de las funciones nuevas:**
  - `madridInstant` en invierno (`+01:00`), verano (`+02:00`) y los dos días de cambio a las 10:00;
  - `madridDateTime` convierte en ambos sentidos con esos casos, incluido `2026-10-24T22:30:00Z` → `{ date: "2026-10-25", time: "00:30" }`;
  - `weekStart("2026-10-25")` da `"2026-10-19"`, `weekStart("2026-10-19")` da `"2026-10-19"` y `addDays("2026-10-25", 1)` da `"2026-10-26"`;
  - `weekdayOf("2026-09-28")` da `1`.
- [ ] **Step 3: implementar y verificar:** `pnpm --filter @clinicalumia/api test`, `make typecheck`, `make test` y `make lint`.
- [ ] **Step 4: commits**

```bash
git commit -m "Compartir las horas de Madrid entre el admin y el dashboard"
git commit -m "Convertir fechas y horas de Madrid a instantes y calcular semanas"
```

---

### Task 2: Citas en la base de datos

**Files:**
- Create: `packages/db/supabase/migrations/20260928090000_citas.sql`, `packages/db/supabase/tests/appointments.test.sql`
- Modify: `packages/db/types.ts` (regenerado)

**Interfaces:**
- Produces:
  - enums `public.appointment_status` (`scheduled`, `cancelled`, `no_show`), `public.appointment_canceller` (`patient`, `clinic`), `public.appointment_modality` (`in_person`, `online`) y `public.appointment_event_kind` (`created`, `moved`, `cancelled`, `no_show`, `restored`);
  - las tablas de la spec, sección 3;
  - errores:
    - `23P01` `appointments_no_overlap` (solape);
    - `23514` con mensajes fijos: `appointment_not_started` (no_show futuro), `appointment_cancelled_final`, `appointment_in_past` (mover una pasada), `appointment_immutable_fields`, `patient_not_bookable`, `service_inactive`, `professional_inactive`, `cancelled_by_required`;
    - `42501` (RLS).

- [ ] **Step 1: pgTAP que falla** (`appointments.test.sql`).

  Usa el `act_as` de `mfa.test.sql`, que crea una sesión real con `aal2`. Hay una propietaria, dos empleadas activas (A y B) y una inactiva, con UUIDs `60000000-…`, más un servicio activo de 45 minutos a 40 €, otro inactivo y un paciente. Cada aserción lleva un mensaje con el porqué:

  - **Visibilidad:**
    - A crea una cita propia, la lee y la ve con `price_cents = 4000` y `vat` copiados del servicio;
    - A no puede insertar una cita con `professional_id` de B (`42501`);
    - B no ve la cita de A (0 filas) y su `update` sobre ella afecta 0 filas;
    - la propietaria ve y actualiza la cita de A;
    - la empleada inactiva ve 0 filas.
  - **`created_by`:** se fuerza a quien crea, aunque se envíe otro.
  - **Solapes:**
    - otra cita de A de 16:55 a 17:40 contra una de 16:10 a 16:55 se permite (se tocan en el límite);
    - una de 16:50 a 17:35 lanza `23P01`;
    - tras cancelar la primera, la de 16:50 se permite.
  - **Duración:** de 7 minutos lanza `23514`; de 0 minutos, también.
  - **Estados:**
    - cancelar sin `cancelled_by` lanza `23514`;
    - cancelar con `patient` fija `cancelled_at`;
    - volver a `scheduled` una cancelada lanza `23514` (`appointment_cancelled_final`);
    - `no_show` en una cita futura lanza `23514` (`appointment_not_started`);
    - en una cita pasada (insertada como `postgres` con fechas pasadas) se permite, y volver a `scheduled` desde `no_show` también (evento `restored`).
  - **Mover:**
    - cambiar `starts_at` y `ends_at` de una futura crea un evento `moved` con la hora anterior;
    - mover una pasada lanza `23514`;
    - cambiar `patient_id` lanza `23514`.
  - **Validaciones al crear:**
    - un paciente archivado lanza `23514` (`patient_not_bookable`);
    - una persona que no es paciente, también;
    - un servicio inactivo lanza `23514` (`service_inactive`).
  - **Historial:**
    - existen `created`, `moved` y `cancelled` con `actor_id` correcto;
    - A no puede insertar ni actualizar `appointment_events` directamente (`42501` o 0 filas);
    - B no ve los eventos de A.
  - **Borrado:** nadie puede borrar citas, ni la propietaria (0 filas).

  Run: `make db.reset && make test.db` → FAIL.

- [ ] **Step 2: Migración.** Escribe la migración con:
  - las tablas y enums de la spec, sección 3, y la exclusión GiST (`create extension if not exists btree_gist with schema extensions` si no está ya; la pieza 1 ya la usa);
  - `check` de duración: `extract(epoch from ends_at - starts_at)` entre 300 y 28800 y múltiplo de 300.
  - trigger `before insert`:
    - fuerza `created_by := auth.uid()` si hay usuario;
    - comprueba que el paciente es `is_patient` y no está archivado;
    - comprueba que el servicio está activo y copia `price_cents` y `vat`;
    - comprueba que el profesional existe y está activo;
    - fija `status := 'scheduled'`.
  - trigger `before update`:
    - impide cambiar `professional_id`, `patient_id`, `service_id`, `created_by`, `price_cents` y `vat`;
    - aplica las transiciones de las Global Constraints;
    - al cancelar, fija `cancelled_at := now()` y exige `cancelled_by`;
    - al mover, exige `status = 'scheduled'` y `old.starts_at > now()`.
  - trigger `after insert or update`, `security definer` con `set search_path = ''`: escribe el evento que corresponda.
  - RLS:
    - `select`, `insert` y `update` con la condición de visibilidad; sin política de `delete`;
    - en `appointment_events`, solo `select` con `exists` sobre la cita visible.

  Mensajes de error con `raise exception '<código>' using errcode = '23514'`. Run: `make db.reset && make test.db && make db.types && make db.types.check` → PASS.

- [ ] **Step 3: commit**

```bash
git commit -m "Guardar citas sin solapes con estados, precio acordado e historial"
```

---

### Task 3: Huecos ocupados de los compañeros y citas de ejemplo

**Files:**
- Create: `packages/db/supabase/migrations/20260928100000_agenda_ocupada.sql`
- Modify: `packages/db/supabase/tests/appointments.test.sql`, `packages/db/supabase/seed.sql`, `packages/db/supabase/tests/seed.test.sql`, `packages/db/types.ts`

**Interfaces:**
- Produces: `public.agenda_busy(p_from timestamptz, p_to timestamptz) returns table (professional_id uuid, starts_at timestamptz, ends_at timestamptz)`:
  - `security definer`, `set search_path = ''`, `stable`;
  - lanza `42501` si no es `is_active_staff()`;
  - lanza `22023` si `p_to <= p_from` o el intervalo supera 31 días;
  - devuelve las citas con `status <> 'cancelled'` que se solapan con el intervalo, de profesionales activos;
  - `grant execute` solo a `authenticated`.

- [ ] **Step 1: pgTAP que falla:**
  - B recibe la cita de A con solo esas tres columnas; se comprueba con `pg_get_function_result`, sin columnas de paciente ni servicio;
  - las canceladas no aparecen;
  - la empleada inactiva y `aal1` reciben `42501`;
  - 40 días lanza `22023`;
  - `anon` no puede ejecutarla.
- [ ] **Step 2: Migración y seed.** Crea citas inventadas para la semana en curso respecto a la fecha del `db reset`: usa `current_date` en Madrid y las horas de los horarios del seed, para que siempre haya citas "esta semana". Las tres cuentas, con Nora, Pablo, Jorge y Elena como pacientes. Al menos una cita pasada y una cancelada. En `seed.test.sql`, cuenta las citas y di por qué (la agenda local tiene contenido realista).
- [ ] **Step 3:** Run: `make db.reset && make test.db && make db.types && make db.types.check` → PASS.
- [ ] **Step 4: commit**

```bash
git commit -m "Mostrar los huecos ocupados de los compañeros sin datos de pacientes y sembrar citas"
```

---

### Task 4: Reglas de la agenda

**Files:**
- Create: `apps/dashboard/lib/agenda.ts`, `apps/dashboard/lib/agenda.test.ts`

**Interfaces:**
- Consumes: `@clinicalumia/api/madrid-time` (Tarea 1).
- Produces:
  - **`type Block = { id: string; kind: "own" | "busy" | "time_off"; professionalId: string; start: string; end: string; label?: string }`**
  - **`layoutDay(blocks: Block[], date: string, firstHour: number, lastHour: number)`**: devuelve `{ id, kind, top: number, height: number }[]`, en minutos desde `firstHour` a 1 px por minuto escalable. Los bloques que empiezan antes o terminan después de lo visible se recortan.
  - **`visibleHours(schedules, weekday)`**: devuelve `{ firstHour, lastHour }` a partir de los tramos de ese día de las personas visibles, redondeados a la hora; `8–20` si no hay tramos.
  - **`scheduleWarnings({ professionalName, start, end, schedules, timeOff })`**: devuelve `string[]`:
    - "Queda fuera del horario de {nombre}." si la cita no cabe entera en un tramo de ese día de la semana, en hora de Madrid;
    - "{nombre} tiene una ausencia ese día ({motivo})." si se solapa con una ausencia.
  - **`parseAppointmentForm(formData)`**: devuelve `{ ok: true; appointment: { professional_id, patient_id, service_id, starts_at, ends_at, notes } } | { error: string }`, con los mensajes:
    - "Elige un paciente.";
    - "Elige un servicio.";
    - "Elige profesional.";
    - "Indica fecha y hora.";
    - "La duración debe estar entre 5 y 480 minutos, en pasos de 5.".

    `starts_at` se calcula con `madridInstant`.
  - **`canMarkNoShow(a, now)`** y **`canMove(a, now)`**: coherentes con las reglas de la base de datos.
  - **`appointmentError(error)`**: traduce los códigos de la Tarea 2 a mensajes en español. En el solape, el nombre y la franja los pone la acción consultando la cita que choca.
  - **`specialtyTone(slug)`**: `logopedia` → sage, `psicologia` → bark, `fisioterapia` → pebble; cualquier otro → neutro.

- [ ] **Step 1: tests que fallan:**
  - `layoutDay` con un bloque de 16:10 a 16:55 con `firstHour` 15: `top` 70, `height` 45;
  - recorte de bloques;
  - `visibleHours`;
  - `scheduleWarnings`:
    - dentro de un tramo, sin avisos;
    - cruzando el fin del tramo, aviso;
    - en sábado sin tramos, aviso;
    - con una ausencia, aviso con el motivo;
    - una cita el 29 de marzo a las 10:00 frente a un tramo de 09:30 a 13:30, sin aviso;
  - `parseAppointmentForm`: cada error y el `starts_at` en verano e invierno;
  - `canMarkNoShow` y `canMove` en los límites;
  - `appointmentError` para cada código.
- [ ] **Step 2: implementar.** Run: `pnpm --filter dashboard test`, `make typecheck` y `make lint`.
- [ ] **Step 3: commit**

```bash
git commit -m "Calcular avisos de horario, disposición del día y reglas de las citas"
```

---

### Task 5: Agenda del día

**Files:**
- Create: `apps/dashboard/app/(app)/agenda/DayView.tsx`, `agenda/AgendaHeader.tsx`, `agenda/SeeAlso.tsx`, `agenda/load.ts`, `e2e/agenda.spec.ts`
- Modify: `apps/dashboard/app/(app)/page.tsx` (sustituye el saludo por la agenda), `apps/dashboard/app/(app)/layout.tsx` (menú: Agenda `/` · Pacientes `/patients`)

**Interfaces:**
- Consumes: Tareas 2–4.
- Produces:
  - `/` con `?date&view=day&with=id,id&appointment=id`;
  - `data-testid`: `agenda-title`, `agenda-prev`, `agenda-next`, `agenda-today`, `agenda-view-day`, `agenda-view-week`, `agenda-new`, `agenda-column` (con `data-professional`), `appointment-block` (con `data-appointment`), `busy-block`, `time-off-block`, `now-line`, `see-also` y `see-also-option`;
  - `load.ts`: `loadAgenda({ date, view, withIds })` en el servidor. Lee:
    - el perfil propio (rol);
    - los profesionales activos y su especialidad;
    - las citas visibles del intervalo (RLS);
    - `agenda_busy` para los compañeros elegidos;
    - horarios y ausencias.

    Si el usuario es la propietaria, todas las personas activas son columnas.

- [ ] **Step 1: e2e que falla**, como `psicologia@lumia.test` con `signIn`:
  - la portada muestra la agenda de hoy con su columna y su nombre;
  - `agenda-next` pasa al día siguiente y actualiza el título;
  - una cita creada para mañana por el test con el cliente de servicio aparece como `appointment-block` con el nombre del paciente;
  - activar a Marc en "Ver también" muestra su columna con un `busy-block` sin el nombre del paciente de una cita suya, también creada por el test;
  - la propietaria ve la columna de todas y el nombre del paciente de las citas de Laura;
  - una ausencia creada por el test aparece como `time-off-block`.

  Limpieza de lo creado.
- [ ] **Step 2: implementar.**
  - Rejilla de 15 minutos con las horas a la izquierda.
  - Columnas con nombre y especialidad.
  - Bloques con `specialtyTone`.
  - `now-line` solo si la fecha es hoy en Madrid.
  - Fuera de horario, sombreado.
  - Clic en una cita propia → `?appointment=id` (el panel llega en la Tarea 8; hasta entonces el parámetro no hace nada).
  - Clic en un hueco vacío de su propia columna → `/appointments/new?date&time&professional`.
  - A 390 px, lista por persona con hora, paciente y servicio.
  - Si falla alguna consulta, alerta con `role="alert"` ("No se ha podido cargar la agenda.").
- [ ] **Step 3: verificar:** gates, `make test.e2e` dos veces y capturas a 1440 y 390 px en el scratchpad.
- [ ] **Step 4: commit**

```bash
git commit -m "Mostrar la agenda del día con los compañeros como ocupado"
```

---

### Task 6: Agenda de la semana

**Files:**
- Create: `apps/dashboard/app/(app)/agenda/WeekView.tsx`
- Modify: `(app)/page.tsx`, `agenda/AgendaHeader.tsx`, `agenda/load.ts`, `e2e/agenda.spec.ts`

**Interfaces:**
- Produces:
  - `view=week`: siete columnas (lunes a domingo) de la persona propia o, para la propietaria, de la persona elegida con `?person=id`;
  - título "Semana del 28 de septiembre al 4 de octubre";
  - flechas de semana en semana;
  - `data-testid`: `week-day` (con `data-date`) y `week-person`.

- [ ] **Step 1: e2e que falla:**
  - cambiar a Semana muestra siete `week-day`, y una cita del test aparece en su día;
  - la semana del 25 de octubre de 2026 (cambio de hora) muestra del 19 al 25 y una cita de las 10:00 del día 25 a las 10:00;
  - la propietaria elige a Marc y ve su semana.
- [ ] **Step 2: implementar.** A 390 px, lista por día.
- [ ] **Step 3: verificar y commit**

```bash
git commit -m "Añadir la vista de semana a la agenda"
```

---

### Task 7: Dar una cita

**Files:**
- Create: `apps/dashboard/app/(app)/appointments/actions.ts`, `appointments/actions.test.ts`, `appointments/new/page.tsx`, `appointments/AppointmentForm.tsx`, `appointments/PatientPicker.tsx`
- Modify: `e2e/agenda.spec.ts`

**Interfaces:**
- Produces:
  - `createAppointment(prev, formData)`:
    - llama a `parseAppointmentForm`;
    - si hay avisos de horario y no llega `confirm=1`, devuelve `{ warnings: string[] }` sin guardar;
    - inserta con `.select("id").single()` y redirige a `/?date=<fecha>&appointment=<id>`;
    - traduce los errores con `appointmentError`; en el solape busca la cita que choca (visible por RLS o por `agenda_busy`) para decir "{nombre} ya tiene una cita de HH:MM a HH:MM.".
  - `searchPatients(query)` usa `toIlikePattern(normalizeSearch(q))` sobre `people` con `is_patient` y sin archivar, hasta 10 resultados, y lanza error si falla.
  - `data-testid`: `appointment-form`, `patient-search`, `patient-option`, `patient-selected`, `appointment-service`, `appointment-professional`, `appointment-date`, `appointment-time`, `appointment-duration`, `appointment-notes`, `appointment-warnings`, `appointment-confirm`, `appointment-error` y `appointment-submit`.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:**
    - un formulario inválido no toca la base de datos;
    - con avisos y sin confirmación no inserta;
    - con confirmación inserta;
    - `23P01` da el mensaje con nombre y franja;
    - `42501` da "No tienes permiso para dar citas a otro profesional.".
  - **e2e:**
    - desde un hueco de mañana, buscar "nora" → elegir → servicio → Guardar → la cita aparece en la agenda;
    - otra cita a las 16:55 contra una de 16:10 a 16:55 se guarda (se tocan en el límite);
    - una a las 16:50 da el error de solape y conserva lo escrito;
    - un sábado da el aviso "Queda fuera del horario" y, tras "Dar la cita igualmente", se guarda;
    - doble clic en Guardar crea una sola cita (cuenta con el cliente de servicio);
    - la propietaria elige profesional.
- [ ] **Step 2: implementar.**
  - `useActionState`, `onSubmit` y `startTransition`, con guarda síncrona contra el doble envío (como `submit-gate` de la pieza 2).
  - Servicios filtrados por la especialidad del profesional; la duración por defecto la del servicio.
  - "Nueva persona" enlaza a `/patients/new`.
  - Profesional fijo para un empleado.
- [ ] **Step 3: verificar y commits**

```bash
git commit -m "Guardar citas desde el dashboard con avisos de horario y errores de solape"
git commit -m "Añadir el formulario de nueva cita con buscador de pacientes"
```

---

### Task 8: Panel de la cita: mover, cancelar y "no se presentó"

**Files:**
- Create: `apps/dashboard/app/(app)/agenda/AppointmentPanel.tsx`, `agenda/MoveForm.tsx`, `agenda/CancelDialog.tsx`
- Modify: `appointments/actions.ts`, `appointments/actions.test.ts`, `(app)/page.tsx`, `e2e/agenda.spec.ts`

**Interfaces:**
- Produces:
  - `moveAppointment(prev, formData)`: mismos avisos y confirmación que al crear; devuelve el error de solape o de "cita pasada".
  - `cancelAppointment(id, by: "patient" | "clinic", reason)`.
  - `markNoShow(id)` y `restoreFromNoShow(id)`.
  - Todas comprueban que alguna fila cambió (0 filas → "No se ha podido …").
  - El panel muestra:
    - hora y profesional, paciente con enlace a `/patients/<id>`, servicio y duración, notas y estado;
    - el bloque "Pago" con el precio acordado y "Los cobros llegarán pronto";
    - el historial ("Creada por Laura el 28/09 a las 10:12", "Movida de 16:00 a 17:00 por…").
  - `data-testid`: `appointment-panel`, `appointment-move`, `appointment-cancel`, `cancel-by`, `cancel-reason`, `cancel-confirm`, `appointment-no-show`, `appointment-restore`, `appointment-history`, `history-item` y `appointment-action-error`.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** cada acción traduce sus errores y detecta 0 filas.
  - **e2e:**
    - abrir una cita del test → mover a otra hora → la agenda la muestra en su sitio y el historial dice "Movida de…";
    - cancelar como "paciente" con motivo → desaparece de la agenda y en el historial aparece "Cancelada por el paciente";
    - en una cita pasada creada por el test, "No se presentó" → atenuada → "Deshacer" la devuelve;
    - en una futura, "No se presentó" no aparece;
    - doble clic en confirmar cancelación crea un solo evento.
- [ ] **Step 2: implementar.** Panel a la derecha en escritorio y a pantalla completa en móvil. `ConfirmDialog` para cancelar y "no se presentó".
- [ ] **Step 3: verificar y commits**

```bash
git commit -m "Mover, cancelar y marcar no presentado desde el dashboard"
git commit -m "Añadir el panel de la cita con su historial a la agenda"
```

---

### Task 9: Citas en la ficha del paciente

**Files:**
- Modify: `apps/dashboard/app/(app)/patients/[id]/page.tsx` y el componente de historial que ya existe, `e2e/patients.spec.ts` o `e2e/agenda.spec.ts`

**Interfaces:**
- Produces:
  - la sección de historial con "Próximas" y "Pasadas": fecha y hora en Madrid, servicio, profesional y estado ("Cancelada por la clínica", "No se presentó");
  - cada una enlaza a `/?date=<fecha>&appointment=<id>`;
  - sin citas, sigue el texto "Aquí aparecerán sus citas, cobros y facturas.";
  - si la consulta falla, se muestra una alerta;
  - `data-testid`: `patient-appointment` y `patient-appointments-error`.

- [ ] **Step 1: e2e que falla:**
  - una cita del test para Nora aparece en su ficha en "Próximas" como empleada que la dio;
  - otra empleada no la ve en la ficha;
  - la propietaria sí.
- [ ] **Step 2: implementar, verificar y commit**

```bash
git commit -m "Mostrar las citas en la ficha del paciente"
```

---

## Siguiente

**3b** (reserva web y área de paciente) sobre `appointments`, `agenda_busy` y los horarios.
