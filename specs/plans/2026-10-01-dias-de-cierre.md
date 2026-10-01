# Días de cierre · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la propietaria cierre la clínica en días concretos y que la reserva web, el área de paciente y la agenda lo respeten.

**Architecture:** Tabla `clinic_closures` con RLS; exclusión en `_free_slots` (fuente de huecos de la reserva y del cambio de cita); sección en Admin › Horarios; aviso en la agenda y en Nueva cita del panel.

**Tech Stack:** Supabase (Postgres, RLS, pgTAP), Next.js 16 (admin, dashboard), packages/ui, Vitest, Playwright.

**Spec:** `specs/2026-10-01-dias-de-cierre-design.md`

## Global Constraints

- Fechas como días de Europe/Madrid; rango con ambos extremos incluidos.
- Lectura `is_active_staff()`, escritura `is_owner()`; nada para `anon`.
- Las citas del equipo no se bloquean; solo se avisa.
- No se cancela ninguna cita automáticamente.
- Migración nueva única: `packages/db/supabase/migrations/20261006090000_dias_de_cierre.sql`; dev y prod iguales.
- Reglas de la casa: textos en español, sin comentarios, `data-testid` > rol > texto, TDD, commits pequeños con título en español sin cuerpo, nunca `--no-verify`.
- Gates: `make lint` (0 avisos), `make typecheck`, `make test` (incluye pgTAP), `make test.e2e` dos veces. Comandos con `export PATH="$HOME/.orbstack/bin:$PATH"` y vigilando el reloj de Docker.

## Review Focus

1. **Cierre que cae en un cambio de hora (25/10/2026) o de varios días:** no queda ningún hueco dentro. pgTAP en la Tarea 1.
2. **Cambio de cita del paciente a un día cerrado:** rechazado aunque llame directamente a la función. pgTAP en la Tarea 1.
3. **Una empleada intenta crear un cierre:** rechazado. pgTAP en la Tarea 1 y e2e en la Tarea 2.
4. **Cierre creado con citas ya dadas:** se listan; ninguna cambia de estado. e2e en la Tarea 2.
5. **Nueva cita en día cerrado:** se puede dar, con aviso. e2e en la Tarea 3.

---

### Task 1: Tabla de cierres y huecos

**Files:** la migración, `packages/db/supabase/tests/clinic_closures.test.sql`, tipos de `@clinicalumia/db`.

**Produces:** tabla `clinic_closures` (spec §4) con RLS; `_free_slots` (redefinida desde su última versión) excluye los huecos cuyo día en Madrid cae en un cierre; las funciones que reservan o cambian una cita y validan contra `_free_slots` lo heredan.

- [ ] **Tests:** pgTAP (permisos, solapes, sin huecos en día cerrado, rango de varios días, 25/10/2026, cambio de cita rechazado, día normal intacto). **Commit:** "Cerrar la clínica en días concretos para la reserva"

---

### Task 2: Días de cierre en el admin

**Files:** `apps/admin/app/(admin)/schedules/*` (sección, formulario, fila, acciones con tests), e2e.

**Produces:** sección «Días de cierre» (spec §3) con alta, lista, borrado con confirmación y aviso de citas afectadas; `data-testid`: `closure-form`, `closure-row`, `closure-delete`, `closure-affected`.

- [ ] **Tests:** unitarios de las acciones (validación: fechas, motivo, solape → mensaje en español); e2e (crear, ver aviso con una cita existente, borrar; una empleada no tiene acceso). **Commit:** "Apuntar los días de cierre en el admin"

---

### Task 3: Cierres en la agenda y en Nueva cita

**Files:** `apps/dashboard/app/(app)/agenda/*`, `apps/dashboard/app/(app)/appointments/*`, `apps/dashboard/lib/agenda.ts` (carga de cierres del rango), e2e (incluida la web).

**Produces:** banda «Clínica cerrada · {motivo}» (`agenda-closure`) y columnas sombreadas en día y semana; aviso en Nueva cita (`appointment-closure-warning`).

- [ ] **Tests:** unitarios de la carga; e2e (banda en la agenda, aviso en Nueva cita y la cita se da igualmente, la web no ofrece el día cerrado). **Commit:** "Marcar los días de cierre en la agenda"
