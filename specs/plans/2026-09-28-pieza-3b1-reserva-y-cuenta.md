# Pieza 3b-1 — Reserva web y cuenta de paciente · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un paciente reserve una cita desde la web. Entra con un enlace mágico que trae también un código, elige "para quién" y la cita aparece al instante en la agenda como "Reserva web". Todo queda preparado para el cobro de la pieza 4.

**Architecture:**
- **Base de datos:** columnas nuevas en citas (origen, cuenta que reserva y datos de pago), ajustes de reserva en `clinic_settings`, y tablas `patient_accounts` y `access_requests`.
  - Funciones **públicas**: `booking_catalog` y `available_slots`.
  - Funciones **de paciente**: `my_people`, `my_appointments`, `add_my_person` y `book_appointment`, todas `security definer` y comprobando que la persona pertenece a la cuenta.
  - El trigger de citas admite reservas de paciente solo cuando las hace `book_appointment`, que marca la transacción con un ajuste local.
- **Web (`apps/web`):** acceso por enlace mágico o código (Supabase Auth), recorrido `/reservar` y envío de emails de confirmación (Resend en producción, Mailpit en local).
- **Dashboard y admin:** etiqueta "Reserva web" y los ajustes de reserva.

**Tech Stack:** Supabase (Postgres, Auth OTP/magic link, RLS, pgTAP) · Next.js 16 · React 19 · `@clinicalumia/ui` · Resend · Vitest · Playwright.

**Spec:** `specs/2026-09-28-pieza-3b-reserva-web-y-area-de-paciente-design.md` (entrega 3b-1). Plataforma: `specs/2026-09-25-plataforma-lumia-v1-design.md`.

## Global Constraints

- **Migraciones:** todo cambio de base de datos es una migración nueva en `packages/db/supabase/migrations`. Las de la 3a ya están en `main`, pero no se han subido a ningún proyecto remoto: se pueden corregir con migraciones nuevas, nunca editándolas. `make db.types` y `make db.types.check` en verde. Nada se aplica en remoto.
- **Pacientes:**
  - Un paciente es un usuario de Supabase **sin perfil de equipo**, con fila en `patient_accounts`. No tiene políticas RLS de escritura directa: todo pasa por las funciones de paciente, que comprueban `auth.uid()` en `patient_accounts` y la pertenencia de cada persona a la cuenta.
  - Personas de la cuenta = personas no archivadas con `email` = email de la cuenta, más los menores (no archivados) tutelados por alguna de ellas.
  - Un email que pertenece a un perfil del equipo **no** puede ser cuenta de paciente: se rechaza con "Esta dirección es del equipo de la clínica; entra desde el panel.".
- **Funciones:** `security definer`, `set search_path = ''` y nombres totalmente cualificados. Revocar `execute` de `public` y `anon` (Supabase se lo da a `anon` directamente) y conceder solo a quien toque:
  - `authenticated` para las de paciente;
  - `anon` y `authenticated` para las públicas.
- **Nunca se devuelve** a un paciente, ni por las funciones públicas: el email, el teléfono ni los datos de otras personas; las notas o motivos de ausencia; los datos de pacientes en huecos.
- **Pago:** un servicio con `booking_payment <> 'none'` solo se reserva online si `clinic_settings.online_payments_enabled` es `true`. Hasta la pieza 4 siempre es `false`: se muestra "Reserva por teléfono" y `book_appointment` lo rechaza. Cada cita copia `payment_required` y `payment_amount_cents` del servicio; `payment_status` es `not_required` si no hay pago.
- **Horas:** siempre `Europe/Madrid`. Huecos cada 15 minutos. Antelación y horizonte salen de `clinic_settings` (24 h y 60 días por defecto). Una cita no cruza la medianoche (regla de la 3a).
- **Emails:** con el helper `sendEmail`, que usa Resend si hay `RESEND_API_KEY` y, si no, la API de envío de Mailpit en local. El remitente de producción es de `notifications.clinicalumia.es`.
- **Web:** la clave de servicio de Supabase solo se usa en el servidor (acciones y rutas), nunca en el cliente. Las rutas nuevas (`/reservar`, `/acceder`, `/mi-cuenta`) no cambian las páginas existentes ni sus capturas visuales: las pruebas `web-visual` siguen verdes.
- **e2e:** cada test crea sus propios emails y datos y los borra. Los emails de acceso se leen en Mailpit por destinatario único. Las cuentas del equipo que haga falta son de usar y tirar (el bloqueo de inicio de sesión de `e2e/auth.ts` sigue igual).
- **Reglas de la casa:** textos en español; sin comentarios en el código; tests con `data-testid` > rol > etiqueta; commits pequeños con título descriptivo en español, sin cuerpo; nunca `--no-verify`.
- **Gates:**
  - siempre: `make lint` (0 avisos), `make typecheck`, `make test` y `make test.db`;
  - en tareas con pantallas o acceso, además `make test.e2e` dos veces con los workers por defecto.
- **Supabase local** sigue arrancado desde la carpeta principal; `make db.reset` desde el worktree aplica sus migraciones. Si un cambio de `config.toml` exige reiniciar Supabase, lo hace el controlador. Docker: si algo tarda más de 2 minutos, parar e informar.

## Review Focus

1. **Un paciente no puede reservar, ver ni tocar personas o citas que no son de su cuenta**, ni llamando a las funciones con ids ajenos. Un email del equipo no puede usarse como cuenta de paciente. Tests en las Tareas 3 y 4.
2. **Los huecos ofrecidos coinciden con lo que `book_appointment` acepta:**
   - antelación y horizonte;
   - dentro del tramo del horario, sin ausencias ni solapes;
   - cambios de hora;
   - "el primer hueco libre" asignado a un profesional libre.

   Tests en las Tareas 2 y 3.
3. **Dos personas reservan el mismo hueco a la vez:** una gana y la otra recibe "Ese hueco ya no está libre" y vuelve a elegir. Tests en las Tareas 3 y 7.
4. **Abuso del acceso:** peticiones repetidas por email o por red se frenan con un mensaje claro, sin revelar si el email existe. Tests en la Tarea 4.
5. **Un servicio con pago configurado** nunca se reserva online mientras no haya cobros. Tests en las Tareas 2, 3 y 6.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/db/supabase/migrations/20260929090000_reservas_web.sql` | Columnas, ajustes, tablas y trigger (crear). |
| `packages/db/supabase/migrations/20260929100000_catalogo_y_huecos.sql` | `booking_catalog`, `available_slots` (crear). |
| `packages/db/supabase/migrations/20260929110000_funciones_de_paciente.sql` | `my_people`, `my_appointments`, `add_my_person`, `book_appointment` (crear). |
| `packages/db/supabase/tests/web_booking.test.sql` | pgTAP (crear). |
| `packages/db/supabase/config.toml`, `templates/magic_link.html` | Plantilla con enlace y código; URLs de retorno de la web (modificar/crear). |
| `packages/api/email.ts` (+ test) | `sendEmail` (Resend o Mailpit) (crear). |
| `scripts/local-env.sh` | La web recibe también la clave de servicio, solo de servidor (modificar). |
| `apps/web/lib/booking.ts` (+ test) | Reglas puras de la web (crear). |
| `apps/web/app/acceder/**`, `apps/web/app/reservar/**`, `apps/web/proxy.ts` | Acceso y reserva (crear). |
| `apps/dashboard/…/agenda/*`, `apps/admin/…/clinic/*`, `apps/admin/…/services/*` | Etiqueta y ajustes (modificar). |
| `e2e/booking.spec.ts`, `e2e/mail.ts` | Recorridos (crear/modificar). |

---

### Task 1: Esquema de reservas web

**Files:**
- Create: `packages/db/supabase/migrations/20260929090000_reservas_web.sql`, `packages/db/supabase/tests/web_booking.test.sql`
- Modify: `packages/db/types.ts`

**Interfaces:**
- Produces:
  - En `appointments`:
    - `origin public.appointment_origin` (`staff`, `web`), por defecto `staff`;
    - `booked_by_account uuid` → `auth.users`, nulo;
    - `payment_required public.booking_payment` (el enum de servicios);
    - `payment_amount_cents integer` (0 si `none` o `percent` sobre 0);
    - `payment_status public.payment_status` (`not_required`, `pending`, `paid`, `refunded`), por defecto `not_required`.
  - En `appointment_events`: `actor_kind public.actor_kind` (`staff`, `patient`), por defecto `staff`.
  - `created_by` y `actor_id` siguen referenciando `profiles`. En reservas de paciente, `created_by` es nulo y el actor de los eventos es nulo con `actor_kind = 'patient'`. La cuenta queda en `booked_by_account`.
  - En `clinic_settings`: `booking_min_notice_hours integer default 24 check (between 0 and 168)`, `booking_horizon_days integer default 60 check (between 1 and 365)`, `online_payments_enabled boolean default false`.
  - `public.patient_accounts(id uuid primary key references auth.users on delete cascade, email text not null unique, created_at, privacy_accepted_at timestamptz, privacy_version text)`: RLS activado y **sin políticas** (solo funciones y servicio).
  - `public.access_requests(id, email text, ip_hash text, created_at)`: RLS activado y sin políticas. Índices por `(email, created_at)` y `(ip_hash, created_at)`.
  - En el trigger `prepare_appointment`:
    - si `current_setting('lumia.booking_account', true)` es igual a `auth.uid()::text`, no aplica la comprobación de personal. Fija `origin = 'web'`, `booked_by_account = auth.uid()` y `created_by = null`. En cualquier otro caso, `origin = 'staff'`;
    - al insertar, copia `payment_required` del servicio y calcula `payment_amount_cents` (`fixed` → valor, `percent` → `round(price * value / 100)`, `full` → precio, `none` → 0);
    - fija `payment_status`: `not_required` si es `none`, `pending` si no.
  - El trigger de eventos pone `actor_kind = 'patient'` y `actor_id = null` cuando la cita es `web` y el actor no es del equipo.

- [ ] **Step 1: pgTAP que falla.**
  - existen las columnas, los enums y los valores por defecto;
  - una cita del equipo queda `origin = 'staff'` con `payment_required` copiado (servicio con `fixed` 1000 → 1000 y `pending`; con `none` → 0 y `not_required`);
  - con el ajuste `lumia.booking_account` igual al `auth.uid()` de una cuenta de paciente, dentro de la misma transacción, una inserción queda `origin = 'web'`, `created_by` nulo y `booked_by_account` = cuenta, y su evento `created` tiene `actor_kind = 'patient'`;
  - sin el ajuste, esa misma cuenta recibe `42501`;
  - un ajuste con un uid distinto del `auth.uid()` también recibe `42501`;
  - `patient_accounts` y `access_requests` no son legibles por `authenticated` ni por `anon`;
  - los ajustes de `clinic_settings` respetan sus límites.

  Para simular la cuenta de paciente, crea un `auth.users` sin perfil, fila en `patient_accounts` y claims `role=authenticated`, con `aal1` y una sesión real.
- [ ] **Step 2: migración, reset, tipos.** Run: `make db.reset && make test.db && make db.types && make db.types.check` → PASS (y todos los tests anteriores siguen en verde).
- [ ] **Step 3: commit**

```bash
git commit -m "Preparar las citas para reservas web y cobro al reservar"
```

---

### Task 2: Catálogo y huecos públicos

**Files:**
- Create: `packages/db/supabase/migrations/20260929100000_catalogo_y_huecos.sql`
- Modify: `packages/db/supabase/tests/web_booking.test.sql`, `packages/db/types.ts`

**Interfaces:**
- Produces:
  - `public.booking_catalog()` → `table (specialty_id uuid, specialty_name text, service_id uuid, service_name text, duration_minutes int, price_cents int, bookable_online boolean, phone_only boolean, professionals jsonb)`:
    - solo servicios activos con `bookable_online`;
    - `phone_only` es verdadero si tiene pago y `online_payments_enabled` es falso;
    - `professionals` es `[{id, full_name}]` de los perfiles activos de esa especialidad.
  - `public.available_slots(p_service_id uuid, p_professional_id uuid, p_from date, p_to date)` → `table (starts_at timestamptz, professional_id uuid)`:
    - `p_professional_id` nulo = todos los de la especialidad;
    - `p_to - p_from` entre 0 y 13 días; si no, `22023`;
    - con el servicio inactivo, no online o `phone_only`, devuelve 0 filas;
    - huecos cada 15 minutos en hora de Madrid, con `starts_at` en `[now() + antelación, fin del día (hoy + horizonte))`;
    - la cita entera cabe dentro de un tramo del horario de ese día de la semana;
    - no se solapa con una ausencia del profesional ni con citas `<> 'cancelled'`;
    - no cruza la medianoche;
    - ordenado por inicio y profesional.
  - Ambas `stable`, `security definer`, con `execute` para `anon` y `authenticated`.

- [ ] **Step 1: pgTAP que falla.**
  - el catálogo no incluye servicios inactivos ni no online, marca `phone_only` en uno con señal y no expone emails;
  - `available_slots` para un profesional con tramo 15:15–20:30 y servicio de 45 minutos: el primer hueco es 15:15, el último 19:45 y no hay 19:50;
  - una cita a las 16:00–16:45 elimina 15:30, 15:45, 16:00 y 16:15, pero 16:45 sigue;
  - una ausencia que cubre el día devuelve 0;
  - la antelación de 24 h excluye los huecos de hoy y los de mañana antes de la misma hora;
  - el horizonte excluye el día 61;
  - en el día de cambio de hora (25 de octubre de 2026) los huecos se dan a la hora de Madrid correcta;
  - con `p_professional_id` nulo devuelve huecos de varios profesionales;
  - con servicio `phone_only`, 0 filas;
  - un rango de 20 días da `22023`;
  - `anon` puede ejecutar ambas y no ve datos de pacientes (comprobado con `pg_get_function_result`).

  Para las fechas usa el día siguiente a "hoy + 2" en Madrid, así no depende de la hora de ejecución.
- [ ] **Step 2: migración, reset, tipos, tests en verde.**
- [ ] **Step 3: commit**

```bash
git commit -m "Ofrecer el catálogo reservable y los huecos libres sin datos de pacientes"
```

---

### Task 3: Funciones de paciente

**Files:**
- Create: `packages/db/supabase/migrations/20260929110000_funciones_de_paciente.sql`
- Modify: `packages/db/supabase/tests/web_booking.test.sql`, `packages/db/types.ts`

**Interfaces:**
- Produces (todas exigen que `auth.uid()` esté en `patient_accounts`; si no, `42501`):
  - `public.my_people()` → `table (id uuid, first_name text, last_name text, birth_date date, is_minor boolean, is_patient boolean, relation text)`, donde `relation` es `self` para las del email o `ward` para los menores tutelados. Sin email ni teléfono.
  - `public.add_my_person(p_first_name text, p_last_name text, p_birth_date date, p_phone text, p_guardian_id uuid, p_relationship public.guardian_relationship, p_is_patient boolean, p_accept_privacy boolean, p_privacy_version text)` → `uuid`:
    - si `p_guardian_id` es nulo, crea un adulto con el email de la cuenta; si no, un menor tutelado por esa persona, que debe ser de la cuenta y mayor de edad;
    - `p_accept_privacy` es obligatorio la primera vez: rellena `privacy_accepted_at` y `privacy_version` en la cuenta;
    - valida con las mismas reglas que la ficha (el trigger de `people` normaliza).
  - `public.book_appointment(p_person_id uuid, p_service_id uuid, p_professional_id uuid, p_starts_at timestamptz)` → `uuid`:
    - la persona tiene que ser de la cuenta y paciente;
    - el hueco `(p_starts_at, profesional)` tiene que estar en `available_slots` para ese servicio y día. Con `p_professional_id` nulo, elige el primer profesional libre en ese inicio;
    - fija el ajuste local `lumia.booking_account` e inserta la cita;
    - errores con mensajes fijos: `person_not_in_account`, `slot_not_available` (incluido un solape `23P01` en carrera, capturado y convertido) y `service_not_bookable`.
  - `public.my_appointments()` → `table (id uuid, person_id uuid, person_name text, starts_at timestamptz, ends_at timestamptz, status appointment_status, service_name text, professional_name text, origin appointment_origin)`: citas de las personas de la cuenta, sin notas ni datos de pago.
  - `execute` solo para `authenticated`.

- [ ] **Step 1: pgTAP que falla.** Hay dos cuentas de paciente (A y B), una familia de A (adulta más menor), un paciente de B y una empleada.
  - `my_people` de A devuelve adulta y menor; el de B, solo lo suyo;
  - la empleada (sin cuenta de paciente) recibe `42501`;
  - `book_appointment`:
    - de A para su menor en un hueco libre crea la cita `web`;
    - de A para la persona de B lanza `person_not_in_account`;
    - en un hueco ocupado, `slot_not_available`;
    - con un servicio con señal, `service_not_bookable`;
    - con profesional nulo, asigna uno de la especialidad;
  - `add_my_person`: sin aceptar privacidad la primera vez falla; un menor con tutor de otra cuenta falla;
  - `my_appointments` de B no ve las de A.
- [ ] **Step 2: migración, reset, tipos, tests en verde.**
- [ ] **Step 3: commit**

```bash
git commit -m "Permitir a cada cuenta de paciente reservar solo para sus personas"
```

---

### Task 4: Acceso de pacientes con enlace mágico y código

**Files:**
- Create:
  - `packages/db/supabase/templates/magic_link.html`, `packages/api/email.ts`, `packages/api/email.test.ts`;
  - en `apps/web/app/acceder/`: `page.tsx`, `codigo/page.tsx`, `actions.ts`, `actions.test.ts`, `confirmar/route.ts`;
  - `apps/web/proxy.ts`.
- Modify: `packages/db/supabase/config.toml`, `scripts/local-env.sh`, `apps/web/package.json`, `e2e/mail.ts`

**Interfaces:**
- Produces:
  - **Plantilla `magic_link`:** asunto "Tu acceso a Clínica LUMIA", el enlace a `{{ .RedirectTo }}` con `token_hash={{ .TokenHash }}&type=email` y el código `{{ .Token }}` bien visible. En `config.toml` van los `additional_redirect_urls` de la web: local `http://localhost:3000`, dev y prod `https://www.clinicalumia.es`. El controlador reinicia Supabase local tras este cambio.
  - **`requestAccess(prev, formData)`:**
    - valida el email;
    - registra la petición en `access_requests` con el `ip_hash` (SHA-256 de la IP con una sal del servidor);
    - por encima de 5 por hora y email, o 20 por hora e IP, devuelve "Demasiados intentos. Espera unos minutos.";
    - si el email es de un perfil del equipo, da el error de las Global Constraints;
    - si no existe usuario, lo crea con la clave de servicio (`auth.admin.createUser({ email, email_confirm: true })`);
    - asegura la fila en `patient_accounts`;
    - llama a `signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: <web>/acceder/confirmar?next=<ruta> } })`;
    - siempre responde lo mismo ("Te hemos enviado un enlace y un código") y no revela si el email ya existía.
  - **`verifyCode(prev, formData)`:** `verifyOtp({ email, token, type: "email" })` y redirige a `next`, validado con `safeNext`.
  - **`acceder/confirmar/route.ts`:** `verifyOtp({ token_hash, type: "email" })` y redirige a `next` validado; si falla, a `/acceder?caducado=1`.
  - **`apps/web/proxy.ts`:** renueva la sesión solo en `/reservar`, `/acceder` y `/mi-cuenta`; no afecta al resto de la web.
  - **`sendEmail({ to, subject, html })` en `@clinicalumia/api/email`:** Resend si hay `RESEND_API_KEY` (remitente `EMAIL_FROM`, por defecto `Clínica LUMIA <no-responder@notifications.clinicalumia.es>`); si no, Mailpit (`POST http://127.0.0.1:54324/api/v1/send`). Lanza un error claro si falla.
  - **`scripts/local-env.sh`:** la web recibe también `SUPABASE_SERVICE_ROLE_KEY` (servidor) y una `ACCESS_IP_SALT` de desarrollo.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios** (`actions.test.ts`, con mocks):
    - email inválido, sin llamadas;
    - límite por email y por IP;
    - email del equipo rechazado;
    - usuario nuevo creado y cuenta asegurada;
    - `signInWithOtp` con `shouldCreateUser: false`;
    - misma respuesta tanto si existía como si no;
    - `verifyCode` con código incorrecto da "El código no es correcto o ha caducado.";
    - `next` externo acaba en `/`.
  - **`email.test.ts`:** elige Resend o Mailpit según el entorno.
  - **e2e:**
    - pedir acceso con un email nuevo → llega a Mailpit con enlace y código → el código abre la sesión (una página de prueba en `/reservar` que muestra el email);
    - con otro email, el enlace abre la sesión;
    - seis peticiones seguidas con el mismo email → la sexta da el mensaje del límite;
    - un email del equipo (de usar y tirar) → error.
- [ ] **Step 2: implementar** (y `e2e/mail.ts`: helper para leer el código del último email de un destinatario).
- [ ] **Step 3: verificar:** gates y `make test.e2e` dos veces; `web-visual` intacto.
- [ ] **Step 4: commits**

```bash
git commit -m "Enviar emails desde el servidor por Resend o Mailpit"
git commit -m "Dar acceso a los pacientes con enlace mágico o código por email"
```

---

### Task 5: Reglas puras de la reserva web

**Files:**
- Create: `apps/web/lib/booking.ts`, `apps/web/lib/booking.test.ts`

**Interfaces:**
- Produces:
  - `groupSlotsByDay(slots, today)`: devuelve `{ date, label, morning: Slot[], afternoon: Slot[] }[]`, en Madrid. La mañana termina antes de las 14:00. Etiquetas "Hoy", "Mañana" y "Jueves 2 de octubre".
  - `parseNewPersonForm(formData, today)`: reutiliza las reglas de la pieza 2 copiándolas en la web desde `@clinicalumia/api`. Si `parsePersonForm` vive en el dashboard, se mueve a `packages/api/person.ts` con sus tests como refactor previo, en un commit aparte y sin cambios de comportamiento.
  - `parseEmail(input)`.
  - `bookingError(error)`: `person_not_in_account` → "Esa persona no está en tu cuenta.", `slot_not_available` → "Ese hueco ya no está libre. Elige otro.", `service_not_bookable` → "Este servicio se reserva por teléfono.", resto → "No se ha podido reservar. Inténtalo de nuevo.".
  - `bookingState`: codifica y decodifica en la URL `servicio`, `profesional`, `inicio` y `persona`, validando uuids e instantes.

- [ ] **Step 1: tests que fallan** (incluida la agrupación en días de cambio de hora). **Step 2: implementar. Step 3: commits** (el refactor de `parsePersonForm`, si hace falta, en su propio commit).

```bash
git commit -m "Compartir la validación de la ficha de persona con la web"
git commit -m "Agrupar huecos y validar la reserva web"
```

---

### Task 6: `/reservar`, pasos 1 a 4 (especialidad, servicio, profesional y hueco)

**Files:**
- Create: `apps/web/app/reservar/page.tsx`, `reservar/load.ts`, `reservar/SlotPicker.tsx`, `e2e/booking.spec.ts`
- Modify: la cabecera de la web (enlace "Reservar cita").

**Interfaces:**
- Produces:
  - Un paso por pantalla con el estado en la URL: `?especialidad`, `servicio`, `profesional` (`cualquiera` o uuid), `fecha` (inicio de la ventana de 14 días) e `inicio`.
  - Los servicios `phone_only` muestran "Reserva por teléfono" con enlace `tel:` y no avanzan.
  - Los huecos se piden a `available_slots` (sin sesión). Paginación "Siguientes días". Si no hay huecos, "No hay huecos estos días" con enlace al teléfono.
  - `data-testid`: `booking-specialty`, `booking-service`, `booking-phone-only`, `booking-professional`, `booking-slot`, `booking-next-days` y `booking-no-slots`.

- [ ] **Step 1: e2e que falla.**
  - sin sesión, especialidad → servicio → "El primer hueco libre" → se ven huecos y elegir uno lleva a la identificación (`/acceder?next=...`);
  - un servicio con señal (creado por el test) muestra `booking-phone-only`;
  - un profesional de usar y tirar sin horario no aparece con huecos.
- [ ] **Step 2: implementar** con estilo de la web y usable a 390 px; capturas en el scratchpad.
- [ ] **Step 3: verificar y commit**

```bash
git commit -m "Elegir especialidad, servicio, profesional y hueco en la reserva web"
```

---

### Task 7: `/reservar`, pasos 5 a 7 (quién, datos, confirmar) y email

**Files:**
- Create: `apps/web/app/reservar/actions.ts`, `reservar/actions.test.ts`, `reservar/WhoStep.tsx`, `reservar/NewPersonForm.tsx`, `reservar/confirmada/page.tsx`
- Modify: `apps/web/app/reservar/page.tsx`, `e2e/booking.spec.ts`

**Interfaces:**
- Produces:
  - Con sesión y hueco elegido: "¿Para quién es la cita?" con `my_people()` más "Otra persona". Si la cuenta no tiene personas, pasa directo a "Tus datos".
  - **`NewPersonForm`:** datos de un adulto ("Es para mí") o de un menor ("Soy su madre/padre/tutor", con la relación). La primera vez incluye la casilla "He leído y acepto la política de privacidad" con enlace a `/privacidad`, obligatoria. Guarda con `add_my_person`.
  - **`confirmBooking(prev, formData)`:**
    - llama a `book_appointment` con guarda contra el doble envío;
    - traduce los errores con `bookingError`;
    - `slot_not_available` vuelve al paso 4 con el aviso;
    - si va bien, envía el email "Cita confirmada" (fecha y hora en Madrid, servicio, profesional, para quién y "Puedes verla o cambiarla en Mi cuenta") y redirige a `/reservar/confirmada?cita=<id>`, que la muestra con `my_appointments()`.
  - `data-testid`: `booking-who`, `booking-person`, `booking-other-person`, `new-person-form`, `privacy-accept`, `booking-summary`, `booking-confirm`, `booking-error` y `booking-confirmed`.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** mapeo de errores, doble envío y email enviado solo si la reserva va bien.
  - **e2e:**
    - un paciente nuevo reserva para sí mismo: elige hueco → código → sus datos con privacidad → confirmar → pantalla confirmada y email en Mailpit. La cita existe con `origin='web'`, comprobado con el cliente de servicio;
    - una madre (la cuenta crea su ficha sin ser paciente) reserva para un menor nuevo;
    - dos navegadores cogen el mismo hueco a la vez: uno confirma y el otro ve "Ese hueco ya no está libre" y vuelve a elegir;
    - un email distinto no ve esas personas.

  Limpieza de usuarios, cuentas, personas y citas.
- [ ] **Step 2: implementar. Step 3: verificar (gates y e2e ×2) y commits**

```bash
git commit -m "Confirmar la reserva web para uno mismo o un menor"
git commit -m "Avisar por email de la cita reservada"
```

---

### Task 8: "Reserva web" en el dashboard y ajustes en el admin

**Files:**
- Modify:
  - dashboard: `apps/dashboard/app/(app)/agenda/AgendaColumn.tsx`, `agenda/AppointmentPanel.tsx`, `lib/appointment-history.ts`, `(app)/page.tsx`;
  - admin: `apps/admin/app/(admin)/clinic/*`, `apps/admin/lib/clinic-settings.ts`, `apps/admin/app/(admin)/services/*`;
  - `e2e/agenda.spec.ts` y `e2e/admin-config.spec.ts`.

**Interfaces:**
- Produces:
  - **Agenda:** los bloques y el panel de citas `web` muestran la etiqueta "Reserva web" (`data-testid="web-booking-badge"`).
  - **Historial:** el evento `created` de una cita web dice "Reservada desde la web el dd/mm a las HH:MM". El nombre de la persona para quien es ya aparece en la cita; no se muestran emails.
  - **Admin, "Datos de la clínica":** sección "Reserva web" con "Antelación mínima (horas)" (0–168) y "Hasta cuántos días se puede reservar" (1–365), validados en `parseClinicSettings`. `online_payments_enabled` no se muestra (llega con la pieza 4).
  - **Admin, servicios:** un servicio con "Se puede reservar desde la web" y pago al reservar muestra el aviso "No se podrá reservar online hasta activar los cobros." (`data-testid="service-phone-only-note"`).

- [ ] **Step 1: tests que fallan.**
  - unit: `parseClinicSettings` con los nuevos campos y sus límites; la línea de historial web;
  - e2e: una cita `web` creada con el cliente de servicio muestra la etiqueta en la agenda de un profesional de usar y tirar; la propietaria de usar y tirar guarda antelación y horizonte; el aviso en servicios.
- [ ] **Step 2: implementar, verificar (gates y e2e ×2) y commits**

```bash
git commit -m "Marcar las reservas web en la agenda"
git commit -m "Configurar la antelación y el horizonte de la reserva web en el admin"
```

---

## Siguiente

**3b-2 · Área de paciente** (`/mi-cuenta`): cambiar y cancelar dentro de plazo, añadir menores, datos de contacto y emails de cambio y cancelación.
