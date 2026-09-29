# Pieza 3c — Recordatorios y calendario · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enviar un recordatorio por email el día antes de cada cita, y dar a cada profesional un calendario suscribible y a cada paciente un `.ics` de su cita.

**Architecture:**
- **Base de datos:**
  - tabla `appointment_reminders`, con el canal previsto para SMS;
  - función `reminder_candidates(p_day)`, solo para `service_role`, que devuelve las citas de un día con sus destinatarios;
  - `profiles.calendar_token`, con sus funciones de gestión;
  - `calendar_feed(p_token)` pública: el token es el secreto, así el panel no necesita la clave de servicio.
- **Paquete compartido:** `@clinicalumia/api/ics`, un generador ICS puro. `sendEmail` gana adjuntos.
- **Web:**
  - una ruta de cron protegida por `CRON_SECRET` que envía los recordatorios;
  - el `.ics` adjunto en "Cita confirmada";
  - "Añadir a mi calendario" en Mi cuenta.
- **Panel:** la ruta del calendario por token y la página "Mi calendario".
- **Admin:** invalidar el calendario de un miembro.

**Tech Stack:** Supabase (Postgres, pgTAP) · Next.js 16 · Vercel Cron · Resend/Mailpit · Vitest · Playwright.

**Spec:** `specs/2026-09-29-pieza-3c-recordatorios-y-calendario-design.md`. La 3b completa está en `main` (32024e5).

## Global Constraints

- **Migraciones:** una sola nueva, `20261001090000_recordatorios_y_calendario.sql`, que crece con las Tareas 1 y 2 mientras no salga de la rama. `make db.types` y `make db.types.check` en verde. Nada se aplica en remoto.
- **Horas:** siempre `Europe/Madrid`. "Mañana" es el día siguiente de Madrid, calculado con los helpers de `@clinicalumia/api/madrid-time` en la web y con `(now() at time zone 'Europe/Madrid')::date + 1` en SQL.
- **Destinatarios del recordatorio**, por orden:
  1. el email de la cuenta que reservó (`booked_by_account` → `patient_accounts.email`);
  2. si no hay cuenta, el email de la persona;
  3. si la persona no tiene email, los emails de sus tutores, sin repetir.

  Si no hay ninguno: se registra `error = 'sin_email'` y no se envía.
- **Idempotencia:** como máximo un envío por cita y canal. Antes de enviar se reserva la cita con una fila `pending`; el índice único parcial `(appointment_id, channel) where status <> 'failed'` impide una segunda reserva, y la selección excluye las citas con una fila `sent` o `pending` de menos de una hora.
- **Evento del calendario del equipo:** `SUMMARY` "Nombre Apellidos · Servicio", nada más del paciente. Solo citas no canceladas, desde Madrid hoy − 30 días hasta hoy + 90 días.
- **`.ics` del paciente:** `SUMMARY` "Cita en Clínica LUMIA · <servicio>"; `LOCATION` es la dirección de `site.address` de la web; `UID` `<appointment_id>@clinicalumia.es`.
- **Funciones:** `security definer`, `set search_path = ''`, nombres cualificados y `revoke execute ... from public, anon`, salvo `calendar_feed`, que se concede a `anon` y a `authenticated`. `reminder_candidates` solo es para `service_role`.
- **Secretos:**
  - `CRON_SECRET` solo en el servidor de la web. En local, `scripts/local-env.sh` escribe `CRON_SECRET="lumia-cron-local"`.
  - Nunca se imprimen secretos ni `packages/db/.env.*`.
- **Web:** no cambia páginas existentes ni capturas visuales (`web-visual` verde).
- **e2e:**
  - datos propios, limpieza completa y en paralelo;
  - nunca se toca `clinic_settings` ni el reloj;
  - el test del cron llama a la ruta con el secreto de desarrollo y filtra por los ids de cita que crea.

  Como el cron procesa todas las citas de mañana, el test comprueba solo sus propias citas y emails.
- **Reglas de la casa:** textos en español; sin comentarios; `data-testid` > rol > etiqueta; commits pequeños con título descriptivo en español, sin cuerpo; nunca `--no-verify`.
- **Gates:**
  - siempre: `make lint` (0 avisos), `make typecheck`, `make test` y `make test.db`;
  - en tareas con pantallas o rutas, además `make test.e2e` dos veces.
  - Antes y durante los e2e, vigilar el reloj de Docker (ver `common-context`).

## Review Focus

1. **Una segunda ejecución del cron no reenvía nada.** Tampoco dos ejecuciones a la vez: cada cita se reserva con una fila `pending` antes de enviar, el índice único hace que la segunda reserva choque (`23505`) y esa ejecución la salta sin enviar. Una reserva `pending` de más de una hora cuenta como fallida. Tests en las Tareas 1 y 4 y en la ronda final.
2. **Cambios de hora:** una cita a las 00:30 del día siguiente, o en un día de cambio de hora, entra en "mañana" correctamente, y el `.ics` lleva la hora UTC correcta. Tests en las Tareas 1 y 3.
3. **Tokens de calendario:** un token cambiado o invalidado, o el de un miembro desactivado, deja de servir al instante (`404`), y nadie puede leer tokens ajenos. Tests en las Tareas 2, 6 y 7.
4. **Nombres con comas, punto y coma, saltos de línea o acentos** no rompen el `.ics`: se escapan y las líneas largas se pliegan. Tests en la Tarea 3.
5. **Un fallo de envío a un destinatario** queda registrado sin impedir los demás. Solo se reintenta si el cron vuelve a ejecutarse el mismo día de Madrid (mientras la cita sigue siendo "mañana"); con un cron diario, en la práctica no se reintenta. Tests en la Tarea 4.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/db/supabase/migrations/20261001090000_recordatorios_y_calendario.sql` | Tabla, funciones y token (crear). |
| `packages/db/supabase/tests/reminders_calendar.test.sql` | pgTAP (crear). |
| `packages/api/ics.ts` (+ test) | Generador ICS (crear). |
| `packages/api/email.ts` (+ test) | Adjuntos (modificar). |
| `apps/web/app/api/cron/recordatorios/route.ts` (+ test), `apps/web/lib/reminders.ts` (+ test), `apps/web/vercel.json` | Recordatorio diario (crear). |
| `apps/web/lib/booking.ts`, `apps/web/app/reservar/actions.ts`, `apps/web/app/mi-cuenta/citas/actions.ts`, `apps/web/app/mi-cuenta/citas/[id]/cita.ics/route.ts` | `.ics` del paciente (modificar/crear). |
| `apps/dashboard/app/calendario/[token]/route.ts`, `apps/dashboard/app/(app)/mi-calendario/*` | Calendario del profesional (crear). |
| `apps/admin/app/(admin)/team/*` | Invalidar calendario (modificar). |
| `scripts/local-env.sh` | `CRON_SECRET` de desarrollo para la web (modificar). |
| `e2e/reminders.spec.ts`, `e2e/calendar.spec.ts` | Recorridos (crear). |

---

### Task 1: Registro de recordatorios y citas candidatas

**Files:**
- Create: `packages/db/supabase/migrations/20261001090000_recordatorios_y_calendario.sql`, `packages/db/supabase/tests/reminders_calendar.test.sql`
- Modify: `packages/db/types.ts`

**Interfaces:**
- Produces:
  - Enum `public.reminder_channel` (`email`, `sms`).
  - Tabla `public.appointment_reminders`:
    - columnas: `id uuid pk default gen_random_uuid()`, `appointment_id uuid not null references public.appointments on delete cascade`, `channel public.reminder_channel not null`, `recipient text not null`, `sent_at timestamptz`, `error text not null default ''`, `created_at timestamptz not null default now()`;
    - índice único parcial `(appointment_id, channel) where sent_at is not null`;
    - RLS activado y sin políticas; `revoke all` a `anon` y `authenticated`.
  - `public.reminder_candidates(p_day date)` → `table (appointment_id uuid, starts_at timestamptz, ends_at timestamptz, person_name text, service_name text, professional_name text, change_deadline timestamptz, can_change boolean, recipients text[])`:
    - citas `scheduled` cuyo inicio en Madrid cae en `p_day`, sin un envío `email` correcto;
    - `recipients` según las Global Constraints, en minúsculas y sin repetir; vacío si no hay ninguno;
    - `change_deadline` y `can_change` con la misma regla que `my_appointments` (plazo del servicio o, si no tiene, el general);
    - `stable security definer`, con `execute` solo para `service_role`.

- [ ] **Step 1: pgTAP que falla.** Personas y citas de usar y tirar para un día X (Madrid hoy + 5):
  - una cita web de una cuenta → el email de la cuenta;
  - una cita del equipo de un adulto con email → su email;
  - un menor sin email con dos tutores → los dos emails;
  - una persona sin email ni tutores → `{}`;
  - una cita cancelada no aparece;
  - una cita de las 00:30 del día X aparece en X y no en X − 1;
  - una cita con un `appointment_reminders` `email` enviado no aparece; con uno fallido (`sent_at` nulo), sí;
  - insertar dos envíos correctos para la misma cita y canal da `23505`;
  - `anon` y `authenticated` no pueden leer la tabla ni ejecutar la función.
- [ ] **Step 2: migración, `make db.reset`, `make db.types`, tests en verde. Step 3: commit**

```bash
git commit -m "Registrar los recordatorios y elegir las citas del día que hay que avisar"
```

---

### Task 2: Tokens del calendario y calendario por token

**Files:**
- Modify: `packages/db/supabase/migrations/20261001090000_recordatorios_y_calendario.sql`, `packages/db/supabase/tests/reminders_calendar.test.sql`, `packages/db/types.ts`

**Interfaces:**
- Produces:
  - `profiles.calendar_token text unique` (nulo por defecto). Se revoca el `SELECT` de esa columna a `anon` y `authenticated`: se hace con `revoke select on public.profiles` y re-`grant select (columnas actuales menos calendar_token)`. Hay que revisar que las consultas existentes del panel y del admin no hagan `select('*')` sobre `profiles`; si alguna lo hace, se cambia por la lista de columnas.
  - `public.my_calendar_token()` → `text`: personal activo con aal2 (`is_active_staff()`); si no, `42501`.
  - `public.regenerate_my_calendar_token()` → `text`: genera `encode(extensions.gen_random_bytes(32), 'base64')` y lo pasa a base64url sin relleno (`translate(..., '+/', '-_')`, sin `=`). Lo guarda y lo devuelve. Personal activo.
  - `public.revoke_calendar_token(p_profile_id uuid)` → `void`: solo `is_owner()`, que lo pone a nulo.
  - Trigger: al pasar `profiles.is_active` a `false`, `calendar_token := null`.
  - `public.calendar_feed(p_token text)` → `table (appointment_id uuid, starts_at timestamptz, ends_at timestamptz, updated_at timestamptz, summary text)`:
    - vacío si el token no existe, es nulo o el perfil no está activo;
    - citas no canceladas del profesional entre Madrid hoy − 30 y hoy + 90 días;
    - `summary` = "Nombre Apellidos · Servicio";
    - con `execute` para `anon` y `authenticated`.

- [ ] **Step 1: pgTAP que falla.**
  - una empleada genera su token (43 caracteres, base64url) y `my_calendar_token()` lo devuelve;
  - otra empleada no puede leer `profiles.calendar_token` (`42501`);
  - `calendar_feed(token)` devuelve sus citas con el `summary` correcto, y no las canceladas ni las de otras personas;
  - regenerar deja el token viejo sin citas;
  - la propietaria invalida el de una empleada; una empleada que intenta invalidar a otra recibe `42501`;
  - desactivar el perfil deja el token a nulo;
  - `anon` ejecuta `calendar_feed` y un token inventado devuelve 0 filas.
- [ ] **Step 2: migración, reset, tipos, tests en verde; revisar los `select` sobre `profiles` en `apps/**` y que `make test` y `make typecheck` sigan en verde. Step 3: commit**

```bash
git commit -m "Dar a cada profesional un enlace secreto a su calendario de citas"
```

---

### Task 3: Generador ICS y adjuntos en los emails

**Files:**
- Create: `packages/api/ics.ts`, `packages/api/ics.test.ts`
- Modify: `packages/api/email.ts`, `packages/api/email.test.ts`, `packages/api/package.json` (export `./ics`)

**Interfaces:**
- Produces:
  - `type IcsEvent = { uid: string; startsAt: string; endsAt: string; stamp: string; summary: string; location?: string; description?: string }`.
  - `icsCalendar({ name, events }: { name: string; events: IcsEvent[] })` → `string`:
    - `BEGIN:VCALENDAR`, `VERSION:2.0`, `PRODID:-//Clinica LUMIA//Agenda//ES`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME:<name>`, `X-WR-TIMEZONE:Europe/Madrid`;
    - cada evento con `UID`, `DTSTAMP`, `DTSTART` y `DTEND` en UTC (`YYYYMMDDTHHMMSSZ`), `SUMMARY`, `LOCATION` y `DESCRIPTION` opcionales, y `STATUS:CONFIRMED`;
    - texto escapado (`\\`, `\;`, `\,`, `\n`), saltos CRLF y líneas plegadas a 75 octetos UTF-8 (continuación con un espacio, sin partir caracteres multibyte).
  - `sendEmail({ to, subject, html, attachments? })`, con `attachments?: { filename: string; content: string; contentType: string }[]`:
    - Resend recibe `attachments: [{ filename, content: Buffer.from(content).toString('base64'), contentType }]`;
    - Mailpit recibe `Attachments: [{ Filename, Content (base64), ContentType }]`.

- [ ] **Step 1: tests que fallan.**
  - un evento con coma, punto y coma y salto de línea en el nombre se escapa;
  - una línea de 200 caracteres con "ñ" y acentos se pliega sin romper caracteres y cada línea ocupa ≤ 75 octetos;
  - `DTSTART` de una cita a las 10:00 de Madrid del 29 de marzo de 2026 y del 25 de octubre de 2026 da la hora UTC correcta;
  - un calendario vacío es válido;
  - los adjuntos llegan a Resend y a Mailpit en base64.
- [ ] **Step 2: implementar. Step 3: commit**

```bash
git commit -m "Generar calendarios ICS y adjuntar archivos a los emails"
```

---

### Task 4: Recordatorio diario

**Files:**
- Create: `apps/web/lib/reminders.ts` (+ test), `apps/web/app/api/cron/recordatorios/route.ts` (+ `route.test.ts`), `apps/web/vercel.json`, `e2e/reminders.spec.ts`
- Modify: `scripts/local-env.sh`

**Interfaces:**
- Consumes:
  - `reminder_candidates(p_day)` y `appointment_reminders` (Tarea 1);
  - `icsCalendar` y los adjuntos de `sendEmail` (Tarea 3);
  - `changeWindowText`, `escapeHtml`, `formatWhen` y la plantilla compartida de emails de cita de `apps/web/lib/booking.ts` y `account.ts`;
  - `site`, `createAdminClient` de `@clinicalumia/api/admin`, `todayInMadrid` y `addDays`.
- Produces:
  - `reminderEmail(candidate)` → `{ subject: "Recordatorio de tu cita", html }`, con "Te recordamos la cita de <persona> mañana, <fecha y hora>", servicio, profesional, dirección, texto del plazo y enlace "Ver Mi cuenta", todo escapado;
  - `patientIcs(candidate)` → `string` (un evento, con el `SUMMARY` y `LOCATION` de las Global Constraints);
  - `sendDailyReminders({ admin, now })` → `{ sent, failed, skipped }`:
    - día = `addDays(todayInMadrid(now), 1)`;
    - por cada candidata sin destinatarios, inserta `{ channel: 'email', recipient: '', error: 'sin_email' }` y suma a `skipped`;
    - por cada destinatario, envía y registra `sent_at` o el `error` (el mensaje). Un `23505` al registrar un envío correcto (carrera con otra ejecución) cuenta como `skipped`;
  - `GET /api/cron/recordatorios`:
    - `401` si `authorization` ≠ `Bearer ${process.env.CRON_SECRET}`, o si `CRON_SECRET` falta;
    - si no, `sendDailyReminders` y `Response.json(result)`.
  - `apps/web/vercel.json`: `{ "crons": [{ "path": "/api/cron/recordatorios", "schedule": "0 8 * * *" }] }`.
  - `local-env.sh`: la web recibe `CRON_SECRET="lumia-cron-local"`.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:**
    - `401` sin secreto o con uno incorrecto, y cuando falta `CRON_SECRET`;
    - `sendDailyReminders` con un cliente simulado: un fallo de envío a un destinatario no impide los demás y queda registrado; sin destinatarios, `sin_email`; un `23505` cuenta como `skipped`;
    - el email escapado y con el texto del plazo;
    - el `.ics` con el `UID` de la cita.
  - **e2e:**
    - para mañana, crea una cita de un adulto con email, una cita de un menor sin email con un tutor y una cita cancelada;
    - llama a la ruta con `Authorization: Bearer lumia-cron-local`;
    - llegan a Mailpit "Recordatorio de tu cita" al adulto (con `cita.ics` adjunto) y al tutor, y nada para la cancelada;
    - `appointment_reminders` tiene los envíos;
    - una segunda llamada no envía nada nuevo a esos destinatarios.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Enviar cada mañana el recordatorio de las citas del día siguiente"
```

---

### Task 5: `.ics` para el paciente al reservar, al cambiar y en Mi cuenta

**Files:**
- Create: `apps/web/app/mi-cuenta/citas/[id]/cita.ics/route.ts`
- Modify:
  - `apps/web/lib/booking.ts` (email de confirmación con adjunto);
  - `apps/web/app/reservar/actions.ts`;
  - `apps/web/app/mi-cuenta/citas/actions.ts` (cambio);
  - `apps/web/app/mi-cuenta/page.tsx` (enlace "Añadir a mi calendario", `data-testid="account-add-to-calendar"`, en cada próxima cita);
  - `e2e/patient-area.spec.ts`, `e2e/booking.spec.ts`.

**Interfaces:**
- Consumes: `patientIcs` (Tarea 4; si hace falta se mueve a un sitio compartido de la web), `sendEmail` con adjuntos y `my_appointments`.
- Produces:
  - "Cita confirmada", al reservar y al cambiar la hora, adjunta `cita.ics` con el mismo `UID` de la cita.
  - `GET /mi-cuenta/citas/<id>/cita.ics`: con sesión de paciente y cita de la cuenta, devuelve `text/calendar; charset=utf-8` y `Content-Disposition: attachment; filename="cita.ics"`. Sin sesión, `401`; una cita ajena o desconocida, `404`.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** la acción de reserva y la de cambio pasan el adjunto.
  - **e2e:**
    - reservar deja en Mailpit un email con `cita.ics`;
    - en Mi cuenta, "Añadir a mi calendario" descarga un `.ics` con la hora de la cita;
    - la ruta con una cita de otra cuenta da `404`.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Dar al paciente su cita en formato calendario"
```

---

### Task 6: Calendario del profesional en el panel

**Files:**
- Create: `apps/dashboard/app/calendario/[token]/route.ts`, `apps/dashboard/app/(app)/mi-calendario/page.tsx`, `mi-calendario/actions.ts` (+ test), `e2e/calendar.spec.ts`
- Modify: `apps/dashboard/app/(app)/layout.tsx` (menú: "Mi calendario"), y el proxy del panel si bloquea `/calendario/*` sin sesión (esta ruta tiene que ser pública).

**Interfaces:**
- Consumes: `calendar_feed`, `my_calendar_token` y `regenerate_my_calendar_token` (Tarea 2); `icsCalendar` (Tarea 3).
- Produces:
  - `GET /calendario/<token>.ics` (el segmento lleva `.ics`; se quita antes de llamar a `calendar_feed`):
    - con el cliente anónimo, llama a `calendar_feed`;
    - si no hay filas y el token no es válido, `404`. Para distinguir "token válido sin citas" de "token inválido", `calendar_feed` necesita un indicador: se añade `public.calendar_token_exists(p_token)` → `boolean` (anon) en la migración, con su pgTAP;
    - si no, `200 text/calendar; charset=utf-8`, `Cache-Control: private, max-age=300`, calendario "LUMIA · <nombre del profesional>".
  - `/mi-calendario`:
    - sin token: "Generar enlace" (`calendar-generate`);
    - con token: el enlace completo (`calendar-url`, a partir de la URL pública del panel), "Copiar" (`calendar-copy`), instrucciones para Google Calendar e iPhone, y "Cambiar enlace" (`calendar-regenerate`) con `ConfirmDialog`.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** las acciones.
  - **e2e:**
    - una profesional de usar y tirar entra, genera el enlace y un `fetch` del enlace devuelve un `.ics` con "Nombre Apellidos · Servicio" de su cita y sin sus notas;
    - "Cambiar enlace" deja el antiguo en `404`;
    - un token inventado da `404`.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Suscribirse al calendario de citas propio desde el panel"
```

---

### Task 7: Invalidar el calendario de un miembro desde el admin

**Files:**
- Modify: `apps/admin/app/(admin)/team/actions.ts` (+ test), `team/MemberRow.tsx`, `e2e/admin-ui.spec.ts` (o el spec del equipo que ya exista)

**Interfaces:**
- Consumes: `revoke_calendar_token(p_profile_id)` (Tarea 2).
- Produces: en cada miembro, "Invalidar calendario" (`member-revoke-calendar`) con `ConfirmDialog` ("Su enlace de calendario dejará de funcionar. Tendrá que generar uno nuevo desde el panel."). Llama a la función y muestra el resultado con el mismo patrón de mensajes que las demás acciones del equipo.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** la acción.
  - **e2e:** la propietaria de usar y tirar invalida el calendario de una empleada que ya tenía enlace, y el enlace da `404`.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Permitir a la propietaria invalidar el calendario de un miembro"
```

---

## Publicación (fuera del plan, con confirmación)

- Vercel (web): `CRON_SECRET` en producción. El cron se activa al desplegar con `vercel.json`.
- Las migraciones de 2, 3a, 3b y 3c se suben a dev y producción con los guardas habituales.
