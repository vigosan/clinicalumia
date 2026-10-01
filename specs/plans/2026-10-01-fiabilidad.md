# Fiabilidad antes de abrir · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los hallazgos de fiabilidad de la auditoría para que la clínica pueda abrir sin citas fantasma ni pacientes sin avisar.

**Architecture:** Cambios en funciones y restricciones SQL (migraciones nuevas), en las acciones del panel y del admin, en `packages/api` (email, ICS) y en el cron de recordatorios de la web.

**Tech Stack:** Supabase (Postgres, RLS, pgTAP), Next.js 16 (web, dashboard, admin), Resend/Mailpit, Vitest, Playwright.

**Spec:** `specs/2026-10-01-fiabilidad-design.md` (hallazgos detallados en `specs/auditoria/`).

## Global Constraints

- Migraciones nuevas con prefijo `2026100709xxxx_`, una por tarea que toque la base; dev y prod iguales.
- Sin cambiar el comportamiento acordado de piezas anteriores salvo lo que dice la spec.
- Emails a pacientes solo si hay destinatario (persona o tutores con email); nunca bloquean la acción si fallan (se registra y se avisa en línea).
- Fechas en Europe/Madrid.
- Reglas de la casa: textos en español, sin comentarios, `data-testid` > rol > texto, TDD, un commit por tarea con el título exacto, sin cuerpo, nunca `--no-verify`, nunca push.
- Gates: `make lint` (0 avisos), `make typecheck`, `make test` (incluye pgTAP), `make test.e2e` dos veces.

## Review Focus

1. **Email al paciente que falla:** la acción del panel se guarda igual y muestra «No se ha podido avisar al paciente». Tarea 1.
2. **Cita movida dos veces el mismo día tras el recordatorio:** recibe recordatorio de la nueva fecha una sola vez. Tarea 2.
3. **Datos existentes que violan la nueva exclusión por paciente:** la migración no falla en prod (comprobar antes y resolver). Tarea 3.
4. **Duplicado archivado:** se ofrece desarchivar, no crear otra. Tarea 4.
5. **Desactivar con citas:** imposible sin resolverlas; recordatorios no salen. Tarea 5.

---

### Task 1: Avisar al paciente de los cambios de la clínica

**Files:** `packages/api/{email,ics}.ts` (+ tests), plantillas de email de cita, acciones de `apps/dashboard/app/(app)/appointments/*` y del panel de la agenda (crear, mover, cancelar), `apps/web/app/mi-cuenta/citas/actions.ts` (asunto «Cita cambiada» y ICS de cancelación), e2e.

**Produces:** función compartida para enviar «Cita confirmada», «Cita cambiada» (antes/ahora) y «Cita cancelada» con ICS (`SEQUENCE`, `METHOD:REQUEST` / `METHOD:CANCEL`); casilla `notify-patient` en Nueva cita, Cambiar fecha u hora y Cancelar cita.

- [ ] **Tests:** unitarios (ICS, plantillas); e2e (dar, mover y cancelar desde el panel → emails en Mailpit con el ICS correcto; casilla desmarcada → sin email; paciente sin email → sin casilla; cambio desde Mi cuenta → asunto «Cita cambiada»). **Commit:** "Avisar al paciente cuando la clínica da, cambia o cancela su cita"

---

### Task 2: Recordatorios que no se pierden

**Files:** migración, `reminder_candidates` y tabla `appointment_reminders` (fila por destinatario y `starts_at`), `apps/web/lib/reminders.ts`, `apps/web/app/api/cron/recordatorios/route.ts`, `apps/web/vercel.json`, pgTAP y unitarios.

**Produces:** segunda ejecución diaria (reintento de fallidos del día); recordatorio de la nueva fecha tras mover; sin recordatorios para profesionales inactivas ni fichas archivadas; `maxDuration = 300`.

- [ ] **Tests:** pgTAP (candidatos tras mover, fallidos reintentables, inactivas excluidas); unitarios (envío parcial a varios tutores). **Commit:** "Reintentar los recordatorios y enviarlos también tras mover la cita"

---

### Task 3: Una persona, una cita a la vez

**Files:** migración (exclusión por `patient_id`, `book_appointment` idempotente y reintento con el siguiente profesional, `reschedule_my_appointment` sin cambios si es la misma hora), mensajes en web y panel, pgTAP, e2e.

**Produces:** error en español al dar en el panel una cita que se solapa con otra del mismo paciente («Este paciente ya tiene una cita a esa hora»); doble confirmación web devuelve la cita existente sin email nuevo.

- [ ] **Tests:** pgTAP (solape rechazado, idempotencia, siguiente profesional, cambio a la misma hora); e2e (doble confirmación web, solape en el panel). Antes de la migración, consulta que detecta solapes existentes y los resuelve o falla con mensaje claro. **Commit:** "Impedir que una persona tenga dos citas a la misma hora"

---

### Task 4: Fichas duplicadas y archivadas

**Files:** migración (`find_possible_duplicates` con nombre sin tildes + fecha y archivadas), `apps/dashboard/app/(app)/patients/*` (aviso con «Desarchivar», error de DNI con enlace), pgTAP, e2e.

- [ ] **Tests:** pgTAP (nombre con y sin tildes + fecha, archivada incluida y marcada); e2e (aviso por nombre+fecha, ficha archivada con «Desarchivar», DNI repetido con enlace). **Commit:** "Detectar fichas duplicadas por nombre y fecha, también archivadas"

---

### Task 5: Sin citas fantasma

**Files:** admin `team` (desactivar con lista de citas y bloqueo), `schedules` (ausencias con citas afectadas, reutilizando la consulta de los cierres), dashboard agenda (columnas de inactivas con citas para la propietaria; reasignar en Cambiar fecha u hora con selector de profesional), `MoveForm`/`computeWarnings` (aviso de cierre), ficha (archivar exige no tener citas futuras), pgTAP/unitarios, e2e.

- [ ] **Tests:** e2e (desactivar con citas bloqueado y listado; reasignar a otra profesional; ausencia avisa; mover a día cerrado avisa; archivar con citas bloqueado). **Commit:** "Evitar citas huérfanas al desactivar, ausentar o archivar"

---

### Task 6: Configuración pendiente y envío de facturas

**Files:** inicio del admin (`apps/admin/app/(admin)/page.tsx`, «Pendiente de configurar»), mensajes de numeración por serie y rol (`apps/dashboard/lib/payments.ts` y migración si hace falta un código de error por serie), listado de servicios («Solo por teléfono»), `apps/dashboard/next.config.ts` (fuentes del PDF para todas las rutas que lo generan), `SendInvoiceForm` y `sendInvoiceEmail` con errores en línea, tests y e2e.

- [ ] **Tests:** unitarios (mensajes por rol y serie); e2e (inicio del admin con pendientes y sin ellos; enviar factura desde `/facturas/[id]`; servicio con señal «Solo por teléfono»). Comprobar con `pnpm --filter dashboard build` que la traza de `/facturas/[id]` incluye las fuentes. **Commit:** "Avisar de lo que falta configurar y enviar facturas desde cualquier pantalla"
