# Pieza 3b-2 — Área de paciente (`/mi-cuenta`) · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un paciente con cuenta vea sus citas y las de sus menores, y las cambie o cancele desde la web dentro del plazo gratuito. También podrá añadir un menor y actualizar teléfono y dirección, y recibirá un email en cada cambio o cancelación.

**Architecture:**
- **Base de datos:** una migración nueva.
  - `my_appointments` se amplía con el plazo.
  - Funciones de paciente nuevas: `reschedule_my_appointment`, `cancel_my_appointment`, `my_contact` y `update_my_contact`, todas `security definer` y comprobando la pertenencia a la cuenta.
  - El registro de eventos marca como "paciente" cualquier cambio hecho por esas funciones, sea la cita web o del equipo.
- **Web (`apps/web`):** `/mi-cuenta` con citas próximas, historial, personas, datos de contacto y "Salir"; pantallas para cambiar la hora, cancelar, añadir un menor y editar el contacto; emails "Cita confirmada" (al cambiar) y "Cita cancelada".
- **Dashboard:** el historial de la cita nombra los cambios y cancelaciones hechos desde la web.

**Tech Stack:** Supabase (Postgres, pgTAP) · Next.js 16 · React 19 · `@clinicalumia/ui` · Vitest · Playwright.

**Spec:** `specs/2026-09-28-pieza-3b-reserva-web-y-area-de-paciente-design.md` (entrega 3b-2). La 3b-1 está en `main` (f861c16).

## Global Constraints

- **Migraciones:** una migración nueva (`20260930090000_area_de_paciente.sql`), que puede crecer con las Tareas 1 y 2 mientras no salga de la rama. Las migraciones de la 3b-1 no se editan. `make db.types` y `make db.types.check` en verde. Nada se aplica en remoto.
- **Pacientes:** mismas reglas que en la 3b-1.
  - Todo pasa por funciones de paciente que comprueban `auth.uid()` en `patient_accounts` y la pertenencia a la cuenta con `my_people()`. Sin cuenta, `42501`.
  - Errores `P0001`, con el código como mensaje.
  - Una cita es "de la cuenta" si su `patient_id` está en `my_people()`, venga de la web o del equipo.
- **Plazo gratuito:** `services.cancellation_hours` si no es nulo; si lo es, `clinic_settings.cancellation_hours`.
  - Se puede cambiar o cancelar si la cita está `scheduled` y `now() < starts_at - plazo`.
  - Fuera de plazo, la web dice "Fuera de plazo: llama al 614 552 808" (el teléfono sale de `site.phone`).
  - Dentro de plazo, dice "Puedes cambiarla o cancelarla hasta el martes 14 a las 18:00", en hora de Madrid.
- **Cambiar:** mismo servicio y mismo profesional (el trigger de la 3a no deja cambiar ninguno de los dos).
  - El nuevo inicio tiene que ser un hueco libre según las reglas de `available_slots`, sin contar la propia cita.
  - Tanto la cita actual como la hora nueva tienen que estar dentro de plazo.
- **Cancelar desde la web:** `cancelled_by = 'patient'`, `cancel_reason = ''`.
- **Funciones:** `security definer`, `set search_path = ''`, nombres cualificados, `revoke execute ... from public, anon`, `grant ... to authenticated`.
- **Nunca se devuelve** a un paciente el email, notas, motivos de ausencia, datos de pago ni datos de otras cuentas. `my_contact` devuelve teléfono y dirección solo de personas de la cuenta.
- **Emails:** con `sendEmail` de `@clinicalumia/api/email`: Resend en producción y Mailpit en local. Se envían al email de la cuenta, con todos los valores escapados. Si el envío falla, la acción ya hecha sigue valiendo: se registra el error con `console.error`.
- **Web:**
  - No hay enlace "Mi cuenta" en la cabecera, porque cambiaría las capturas visuales.
  - A `/mi-cuenta` se llega:
    - desde `/acceder`, que ahora lleva a `/mi-cuenta` por defecto;
    - desde el enlace de los emails;
    - desde la pantalla de cita confirmada.
  - Los botones de cita de las páginas no se tocan.
  - `web-visual` sigue verde sin tocar capturas.
- **e2e:** datos y emails propios por test, limpieza completa y paralelo. La cuenta se abre con el flujo de código de la 3b-1 (helpers de `e2e/booking.spec.ts` y `e2e/mail.ts`). Para simular "fuera de plazo" se crea la cita dentro del plazo del servicio: nunca se toca el reloj ni `clinic_settings`.
- **Reglas de la casa:** textos en español; sin comentarios; `data-testid` > rol > etiqueta; commits pequeños con título descriptivo en español, sin cuerpo; nunca `--no-verify`.
- **Gates:**
  - siempre: `make lint` (0 avisos), `make typecheck`, `make test` y `make test.db`;
  - en tareas con pantallas, además `make test.e2e` dos veces.
  - Antes de los e2e, comprobar que el reloj de Docker coincide con el del Mac.

## Review Focus

1. **Una cuenta no puede ver, cambiar ni cancelar citas de otra cuenta**, ni pasando ids ajenos. Tests en las Tareas 1 y 5.
2. **El plazo se aplica igual en la base de datos y en la web.** En el límite exacto ya no se puede; con el plazo propio del servicio o el general. Tests en las Tareas 1, 3 y 5.
3. **Cambiar a un hueco ocupado entre medias** da "Ese hueco ya no está libre. Elige otro." y vuelve a elegir. Cambiar a la misma hora o a una que se solapa solo consigo misma se acepta. Tests en las Tareas 1 y 6.
4. **Citas del equipo:** un paciente puede cancelar una cita que le reservó la clínica, y el historial la marca como cancelada por el paciente desde la web. Tests en las Tareas 1 y 8.
5. **Sin sesión, `/mi-cuenta` y sus subpáginas llevan a `/acceder?next=…`** y, al entrar, vuelven donde estaban. Tests en la Tarea 4.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/db/supabase/migrations/20260930090000_area_de_paciente.sql` | Funciones de cambio, cancelación y contacto; eventos de paciente (crear). |
| `packages/db/supabase/tests/patient_area.test.sql` | pgTAP (crear). |
| `apps/web/lib/account.ts` (+ test) | Reglas puras del área: plazo, agrupación, formulario de contacto, emails (crear). |
| `apps/web/app/mi-cuenta/**` | Pantallas y acciones (crear). |
| `apps/web/app/acceder/actions.ts`, `apps/web/app/reservar/confirmada/page.tsx`, `apps/web/lib/booking.ts` | Por defecto a `/mi-cuenta`; enlace a Mi cuenta (modificar). |
| `apps/dashboard/lib/appointment-history.ts` (+ test) | Líneas de cambio y cancelación desde la web (modificar). |
| `e2e/patient-area.spec.ts` | Recorridos (crear). |

---

### Task 1: Cambiar y cancelar en la base de datos

**Files:**
- Create: `packages/db/supabase/migrations/20260930090000_area_de_paciente.sql`, `packages/db/supabase/tests/patient_area.test.sql`
- Modify: `packages/db/types.ts`

**Interfaces:**
- Consumes (3b-1):
  - `my_people()`, `available_slots(...)`;
  - `book_appointment` (su forma de marcar la transacción con `set_config('lumia.booking_account', auth.uid()::text, true)` y de convertir `23P01` en `slot_not_available`);
  - `record_appointment_event()`, `guard_appointment_update()` (en `20260929090000_reservas_web.sql`).
- Produces:
  - `public.my_appointments()` → `table (id uuid, person_id uuid, person_name text, starts_at timestamptz, ends_at timestamptz, status appointment_status, service_id uuid, service_name text, professional_id uuid, professional_name text, origin appointment_origin, cancelled_by appointment_canceller, change_deadline timestamptz, can_change boolean)`.
    - Se hace `drop` y `create` porque cambia el tipo devuelto. Hay que revisar sus usos en la web (`reservar/confirmada`) y los tipos.
    - `change_deadline = starts_at - plazo`.
    - `can_change = status = 'scheduled' and now() < change_deadline`.
    - Las citas de todas las personas de la cuenta, vengan de la web o del equipo, ordenadas por `starts_at`.
  - `public.reschedule_my_appointment(p_appointment_id uuid, p_starts_at timestamptz)` → `uuid`:
    - `appointment_not_in_account` si la cita no es de la cuenta;
    - `outside_change_window` si no `can_change`, o si el nuevo inicio queda antes de su propio plazo (`p_starts_at - plazo <= now()`);
    - `slot_not_available` si `p_starts_at` no es un hueco libre para ese servicio y profesional. Se ignora la propia cita, con un helper interno `public._free_slots(p_service_id, p_professional_id, p_from, p_to, p_ignore_appointment uuid)`, sin `grant`, del que `available_slots` pasa a ser un envoltorio con `p_ignore_appointment = null`, con el mismo resultado. Un `23P01` en carrera también da `slot_not_available`;
    - marca la transacción y actualiza `starts_at` y `ends_at`, conservando la duración.
  - `public.cancel_my_appointment(p_appointment_id uuid)` → `void`:
    - `appointment_not_in_account` y `outside_change_window` como arriba;
    - marca la transacción y pone `status = 'cancelled'` y `cancelled_by = 'patient'`.
  - `record_appointment_event()` redefinida: `patient_actor` pasa a ser solo la marca (`lumia.booking_account = auth.uid()`) más la fila en `patient_accounts`, sin exigir `origin = 'web'`.

- [ ] **Step 1: pgTAP que falla.** Hay dos cuentas (A y B), una cita web de A, una cita del equipo para una persona de A, una empleada y un servicio con plazo propio de 48 h. Los casos:
  - `my_appointments` de A trae las dos citas con `can_change` correcto y `change_deadline` según el plazo del servicio o el general; el de B no las ve;
  - `reschedule_my_appointment`:
    - de A a otro hueco libre mueve la cita, mantiene la duración y deja un evento `moved` con `actor_kind = 'patient'` y `actor_id` nulo;
    - mover 15 minutos, solapando solo consigo misma, funciona;
    - B con la cita de A da `appointment_not_in_account`;
    - a un hueco ocupado da `slot_not_available`;
    - una cita dentro del plazo de 48 h (inicio a `now() + 30 h`) da `outside_change_window`;
    - una hora nueva fuera de plazo da `outside_change_window`;
  - `cancel_my_appointment`:
    - de A sobre la cita del equipo la deja `cancelled` con `cancelled_by = 'patient'` y un evento de paciente;
    - fuera de plazo da `outside_change_window`;
    - sobre una cita ya cancelada, también `outside_change_window`;
  - la empleada (sin cuenta) recibe `42501`;
  - `anon` no puede ejecutar ninguna.
  - `available_slots` da el mismo resultado que antes en los casos de la 3b-1: `make test.db` completo.

  Las fechas se calculan a partir de Madrid hoy + 3, con horarios de usar y tirar.
- [ ] **Step 2: migración, `make db.reset`, `make db.types`, tests en verde** (incluida la web: `reservar/confirmada` compila con el nuevo `my_appointments`).
- [ ] **Step 3: commit**

```bash
git commit -m "Permitir al paciente cambiar y cancelar sus citas dentro de plazo"
```

---

### Task 2: Datos de contacto en la base de datos

**Files:**
- Modify: `packages/db/supabase/migrations/20260930090000_area_de_paciente.sql`, `packages/db/supabase/tests/patient_area.test.sql`, `packages/db/types.ts`

**Interfaces:**
- Produces:
  - `public.my_contact(p_person_id uuid)` → `table (phone text, address text)`. Da `person_not_in_account` si la persona no es de la cuenta.
  - `public.update_my_contact(p_person_id uuid, p_phone text, p_address text)` → `void`:
    - `person_not_in_account` si la persona no es de la cuenta;
    - valida el teléfono con las reglas de la ficha (el trigger de `people` normaliza). Un teléfono inválido da `invalid_phone`;
    - la dirección se recorta y tiene como máximo 300 caracteres (`address_too_long`).

- [ ] **Step 1: pgTAP que falla:**
  - A lee y cambia el contacto de su adulta y de su menor;
  - B con la persona de A da `person_not_in_account` en las dos funciones;
  - un teléfono inválido da `invalid_phone`;
  - la empleada recibe `42501` y `anon` no puede ejecutarlas.
- [ ] **Step 2: migración, reset, tipos, tests en verde. Step 3: commit**

```bash
git commit -m "Permitir al paciente ver y cambiar el teléfono y la dirección de sus personas"
```

---

### Task 3: Reglas puras del área de paciente

**Files:**
- Create: `apps/web/lib/account.ts`, `apps/web/lib/account.test.ts`

**Interfaces:**
- Consumes: `@clinicalumia/api/madrid-time`, `site.phone`, `escapeHtml` y `formatWhen` de `apps/web/lib/booking.ts`; la forma de `my_appointments` de la Tarea 1.
- Produces:
  - `splitAppointments(rows, now)` → `{ upcoming, history }`:
    - `upcoming` son las citas `scheduled` con `starts_at >= now`, ordenadas de la más próxima a la más lejana;
    - `history` es el resto, de la más reciente a la más antigua.
  - `changeWindowText(row)`:
    - dentro de plazo: "Puedes cambiarla o cancelarla hasta el martes 14 a las 18:00", con el día de la semana en minúscula, el día del mes y la hora en Madrid;
    - fuera de plazo: "Fuera de plazo: llama al 614 552 808".
  - `statusLabel(row)`:
    - "Cancelada por ti" si la canceló el paciente;
    - "Cancelada por la clínica";
    - "No asististe";
    - "Realizada" si es pasada y `scheduled`;
    - "Próxima".
  - `parseContactForm(formData)` → `{ phone, address } | { error }`, con las reglas de teléfono de `@clinicalumia/api/person`.
  - `accountError(error)`:
    - `appointment_not_in_account` → "Esa cita no está en tu cuenta.";
    - `outside_change_window` → "Ya no se puede cambiar desde la web. Llama al 614 552 808.";
    - `slot_not_available` → "Ese hueco ya no está libre. Elige otro.";
    - `person_not_in_account` → "Esa persona no está en tu cuenta.";
    - `invalid_phone` → "Escribe un teléfono válido.";
    - `address_too_long` → "La dirección es demasiado larga.";
    - resto → "No se ha podido guardar. Inténtalo de nuevo.".
  - `rescheduledEmail({...})`, con asunto "Cita confirmada", y `cancelledEmail({...})`, con asunto "Cita cancelada". Llevan fecha y hora en Madrid, servicio, profesional, para quién y un enlace "Ver Mi cuenta" a `${site.url}/mi-cuenta`. Todo escapado.

- [ ] **Step 1: tests que fallan.**
  - el límite exacto del plazo: `now == deadline` ya no se puede;
  - el plazo en los dos días del cambio de hora;
  - la agrupación;
  - todas las etiquetas;
  - un formulario de contacto inválido;
  - los emails con `<b>` escapado.
- [ ] **Step 2: implementar. Step 3: commit**

```bash
git commit -m "Reglas del área de paciente: plazo, citas y emails de cambio y cancelación"
```

---

### Task 4: `/mi-cuenta` (resumen) y llegada desde el acceso

**Files:**
- Create: `apps/web/app/mi-cuenta/page.tsx`, `mi-cuenta/load.ts`, `mi-cuenta/actions.ts` (salir), `e2e/patient-area.spec.ts`
- Modify:
  - `apps/web/app/acceder/actions.ts`: `next` por defecto `/mi-cuenta`;
  - `apps/web/app/reservar/confirmada/page.tsx` y `apps/web/lib/booking.ts` (email de confirmación): "Mi cuenta" pasa a ser un enlace a `/mi-cuenta`.

**Interfaces:**
- Consumes: `my_appointments`, `my_people`, `my_contact` y las reglas de la Tarea 3.
- Produces:
  - Sin sesión: redirige a `/acceder?next=/mi-cuenta`.
  - Con una sesión del equipo: muestra el mensaje de la 3b-1 ("Esta dirección es del equipo de la clínica; entra desde el panel."). Se reutiliza `TeamSession`.
  - Secciones:
    - "Próximas citas" (`account-upcoming`): cada cita (`account-appointment`) con fecha y hora, para quién, servicio, profesional y el texto del plazo. Si `can_change`, lleva los enlaces "Cambiar" (`account-reschedule`) y "Cancelar" (`account-cancel`).
    - "Historial" (`account-history`).
    - "Personas" (`account-people`), con "Añadir un menor" (`account-add-minor`).
    - "Datos de contacto" (`account-contact`): teléfono y dirección de las personas adultas de la cuenta, con "Cambiar" (`account-edit-contact`).
    - "Salir" (`account-logout`): cierra la sesión y lleva a `/`.
  - Sin citas: "Todavía no tienes citas" y un enlace a `/reservar`.
  - Con el estilo de la web (`PageHero` como en `/acceder`) y usable a 390 px. Capturas en el scratchpad.

- [ ] **Step 1: e2e que falla.**
  - un paciente con una cita web (reservada por `book_appointment` con su sesión) y otra del equipo ve las dos en "Próximas citas" con su texto de plazo;
  - la cita dentro de plazo tiene "Cambiar" y "Cancelar"; la de fuera de plazo dice "Fuera de plazo: llama al 614 552 808" y no tiene enlaces;
  - `/mi-cuenta` sin sesión → `/acceder?next=%2Fmi-cuenta` → el código → vuelve a `/mi-cuenta`;
  - `/acceder` sin `next` → tras el código, llega a `/mi-cuenta`;
  - otro email no ve esas citas;
  - "Salir" cierra la sesión.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Mostrar al paciente sus citas, personas y datos en Mi cuenta"
```

---

### Task 5: Cancelar desde Mi cuenta

**Files:**
- Create: `apps/web/app/mi-cuenta/citas/[id]/cancelar/page.tsx`, `mi-cuenta/citas/actions.ts` (+ `actions.test.ts`)
- Modify: `e2e/patient-area.spec.ts`

**Interfaces:**
- Produces:
  - Una pantalla de confirmación (`cancel-summary`): la cita, el texto del plazo y "Cancelar cita" (`cancel-confirm`), con doble envío bloqueado mientras está pendiente.
  - Si la cita no es de la cuenta: `notFound()`.
  - Si ya no está en plazo: se muestra el texto de fuera de plazo, sin botón.
  - `cancelAppointment(prev, formData)`:
    - llama a `cancel_my_appointment`;
    - traduce los errores con `accountError`;
    - si va bien, envía `cancelledEmail` a la cuenta y redirige a `/mi-cuenta?aviso=cancelada`, que muestra "Cita cancelada" (`account-notice`).

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** errores, email solo si va bien, el fallo del email no deshace.
  - **e2e:**
    - cancelar una cita en plazo: pasa al historial como "Cancelada por ti", llega "Cita cancelada" a Mailpit y la base de datos tiene `cancelled_by = 'patient'`;
    - la página de cancelar de una cita fuera de plazo no tiene botón;
    - un id de otra cuenta da 404.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Cancelar una cita desde Mi cuenta dentro de plazo"
```

---

### Task 6: Cambiar la hora desde Mi cuenta

**Files:**
- Create: `apps/web/app/mi-cuenta/citas/[id]/cambiar/page.tsx`
- Modify: `mi-cuenta/citas/actions.ts` (+ test), `e2e/patient-area.spec.ts`

**Interfaces:**
- Consumes:
  - `available_slots` con el servicio y el profesional de la cita;
  - `SlotPicker` y `groupSlotsByDay` de `/reservar`, reutilizados sin copiarlos;
  - `reschedule_my_appointment`.
- Produces:
  - La pantalla muestra la cita actual y los huecos del mismo profesional desde hoy, en ventanas de 14 días con "Siguientes días" hasta el horizonte.
    - La hora actual de la cita no se ofrece.
    - Los huecos cuyo propio plazo ya ha pasado no se muestran: solo se ofrecen inicios con `inicio - plazo > now()`.
  - Al elegir un hueco: un resumen "De … a …" y "Confirmar el cambio" (`reschedule-confirm`).
  - `rescheduleAppointment(prev, formData)`:
    - con `slot_not_available`, vuelve a los huecos con el aviso (`booking-error`);
    - si va bien, envía `rescheduledEmail` y redirige a `/mi-cuenta?aviso=cambiada`, que muestra "Cita cambiada".
  - Fuera de plazo o una cita ajena: como en la Tarea 5.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** errores y email.
  - **e2e:**
    - cambiar una cita a otro hueco: la nueva hora aparece en Mi cuenta, llega "Cita confirmada" con la nueva hora y la duración se mantiene;
    - si otro paciente coge ese hueco mientras tanto, se ve "Ese hueco ya no está libre. Elige otro.";
    - una cita fuera de plazo no tiene la página de cambiar.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Cambiar la hora de una cita desde Mi cuenta dentro de plazo"
```

---

### Task 7: Añadir un menor y cambiar los datos de contacto

**Files:**
- Create: `apps/web/app/mi-cuenta/menores/nuevo/page.tsx`, `mi-cuenta/contacto/[id]/page.tsx`, `mi-cuenta/personas/actions.ts` (+ test)
- Modify: `e2e/patient-area.spec.ts`

**Interfaces:**
- Consumes:
  - `add_my_person`, `my_privacy_accepted`, `my_people`, `my_contact`, `update_my_contact`;
  - de `/reservar`: `NewPersonForm` (modo menor, con los adultos de la cuenta como posible tutor) y `personError`, reutilizados;
  - `parseContactForm` y `accountError`.
- Produces:
  - **"Añadir un menor"** guarda con `add_my_person`, con el adulto elegido como tutor y la relación. Si hace falta, muestra la casilla de privacidad. Vuelve a `/mi-cuenta?aviso=menor`.
  - Si la cuenta no tiene ningún adulto con fecha de nacimiento, se piden primero los datos del adulto, como en la 3b-1.
  - **Contacto:** un formulario con teléfono y dirección de una persona de la cuenta. Guarda con `update_my_contact` y vuelve a `/mi-cuenta?aviso=contacto`.

- [ ] **Step 1: tests que fallan** (unitarios de las acciones y e2e):
  - añadir un menor: aparece en "Personas" y luego se puede elegir en `/reservar`;
  - cambiar el teléfono y la dirección: se ven en Mi cuenta y en la base de datos;
  - un teléfono inválido muestra el error;
  - la persona de otra cuenta en la URL de contacto da 404.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Añadir un menor y cambiar los datos de contacto desde Mi cuenta"
```

---

### Task 8: Cambios y cancelaciones del paciente en el historial del dashboard

**Files:**
- Modify: `apps/dashboard/lib/appointment-history.ts` (+ test), `e2e/agenda.spec.ts`

**Interfaces:**
- Produces:
  - Para eventos con `actor_kind = 'patient'`:
    - `moved`: "Cambiada desde la web el dd/mm a las HH:MM (antes: dd/mm HH:MM)";
    - `cancelled`: "Cancelada desde la web el dd/mm a las HH:MM".
  - Todo en hora de Madrid y sin emails.
  - `created` sigue como en la 3b-1.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** las dos líneas.
  - **e2e:** una cita del equipo cancelada por el paciente, con su sesión llamando a `cancel_my_appointment`, muestra la línea en el panel de la cita de una profesional de usar y tirar.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Mostrar en el historial los cambios y cancelaciones hechos desde la web"
```

---

## Siguiente

- **3c:** recordatorios y calendario ICS.
- **Publicación de las piezas 2, 3a, 3b** en dev y producción (Parte B), con confirmación en cada paso.
