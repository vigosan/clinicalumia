# Pieza 4a — Cobros en clínica · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar en el panel el cobro de cada sesión, anularlo con rastro si hay un error, ver la caja del día por forma de pago y las citas pendientes de cobro.

**Architecture:**
- **Base de datos:** tabla `payments`, sin escritura directa; las funciones `collect_payment`, `void_payment` y `suggested_amount` validan todo.
- **Panel:** el estado y las acciones de cobro dentro del panel de la cita, y dos páginas nuevas, `/cobros` y `/cobros/pendientes`.

**Tech Stack:** Supabase (Postgres, pgTAP) · Next.js 16 · Vitest · Playwright.

**Spec:** `specs/2026-09-30-pieza-4a-cobros-en-clinica-design.md`. Base: `main` f5068dc.

## Global Constraints

- **Migraciones:** una sola nueva, `20261003090000_cobros.sql`, que se edita en el sitio mientras no salga de la rama. `make db.types` y `make db.types.check` en verde. Nada se aplica en remoto.
- **Permisos:**
  - `payments` se lee con `is_active_staff()` (aal2);
  - nadie escribe directamente: `revoke insert, update, delete` a `anon` y `authenticated`, y `appointments` no se toca;
  - las funciones son `security definer`, con `search_path = ''`, `revoke` a `public` y `anon`, y `grant` a `authenticated`, comprobando `is_active_staff()` (si no, `42501`).
- **Importe propuesto:** `appointments.price_cents` menos `payment_amount_cents` si `payment_status = 'paid'`, nunca por debajo de 0. Hace falta motivo si el importe es distinto del propuesto o si la cita está cancelada.
- **Qué se cobra:** citas con `starts_at <= now()`. Las canceladas solo con motivo. Un solo cobro vigente por cita.
- **Anular:** motivo obligatorio. Puede hacerlo quien cobró el mismo día de Madrid (`(collected_at at time zone 'Europe/Madrid')::date = (now() at time zone 'Europe/Madrid')::date`), y la propietaria (`is_owner()`) siempre.
- **Textos:**
  - formas de pago: "Efectivo", "Tarjeta", "Bizum", "Transferencia";
  - estados: "Pagada", "Sin cobro", "Pendiente de cobro".
- **Importes:** en céntimos en la base de datos. En pantalla, formato español ("45,00 €"). En los formularios se aceptan "45", "45,5" y "45,50".
- **Horas:** `Europe/Madrid` con los helpers de `@clinicalumia/api/madrid-time`.
- **e2e:**
  - datos propios, limpieza completa y en paralelo;
  - para limpiar `payments` en los e2e se borra con la clave de servicio. `on delete restrict` impide borrar citas con cobros, así que se borran antes los cobros;
  - se vigila el reloj de Docker.
- **Reglas de la casa:** textos en español; sin comentarios; `data-testid` > rol > etiqueta; commits pequeños con título descriptivo en español, sin cuerpo; nunca `--no-verify`.
- **Gates:**
  - siempre: `make lint` (0 avisos), `make typecheck`, `make test` y `make test.db`;
  - en tareas con pantallas, además `make test.e2e` dos veces.

## Review Focus

1. **Dos personas cobran la misma cita a la vez:** una gana y la otra ve "Esta cita ya está cobrada." Tests en las Tareas 1 y 3.
2. **Importes escritos a mano** ("45,5", "45.50", "", "-3", "abc", "1.000,00") se interpretan bien o se rechazan con un mensaje claro. Tests en la Tarea 2.
3. **El total del día solo suma cobros vigentes**, y los anulados se ven como anulados. Tests en las Tareas 2 y 4.
4. **Una cita de las 23:30** se cuenta en su día de Madrid, también en los cambios de hora. Tests en las Tareas 2 y 4.
5. **Una empleada no puede anular el cobro de otra ni uno suyo de ayer;** la propietaria sí. Tests en las Tareas 1 y 3.

---

### Task 1: Cobros en la base de datos

**Files:**
- Create: `packages/db/supabase/migrations/20261003090000_cobros.sql`, `packages/db/supabase/tests/payments.test.sql`
- Modify: `packages/db/types.ts`

**Interfaces:**
- Produces:
  - Enum `public.payment_method` (`cash`, `card`, `bizum`, `transfer`).
  - Tabla `public.payments`:
    - columnas: `id uuid pk default gen_random_uuid()`, `appointment_id uuid not null references public.appointments on delete restrict`, `amount_cents integer not null check (amount_cents >= 0)`, `method public.payment_method not null`, `vat public.vat_treatment not null`, `note text not null default '' check (char_length(note) <= 500)`, `collected_at timestamptz not null default now()`, `collected_by uuid not null references public.profiles`, `voided_at timestamptz`, `voided_by uuid references public.profiles`, `void_reason text not null default ''`;
    - check: `voided_at` nulo ⇔ `voided_by` nulo, y si está anulado, `void_reason <> ''`;
    - índice único parcial `(appointment_id) where voided_at is null`, más índices en `(collected_at)` y `(appointment_id)`.
  - `public.suggested_amount(p_appointment_id uuid)` → `integer` (personal activo).
  - `public.collect_payment(p_appointment_id uuid, p_amount_cents integer, p_method public.payment_method, p_note text)` → `uuid`:
    - errores `P0001`: `appointment_not_found`, `appointment_not_started`, `appointment_cancelled_needs_note`, `note_required`, `invalid_amount`, `already_paid` (un `23505` en carrera también se convierte en `already_paid`);
    - copia `vat` de la cita y registra `collected_by = auth.uid()`;
    - el motivo se recorta y se limita a 500 caracteres.
  - `public.void_payment(p_payment_id uuid, p_reason text)` → `void`, con los errores `payment_not_found`, `reason_required`, `already_voided` y `not_allowed`.

- [ ] **Step 1: pgTAP que falla.** Los casos:
  - cobrar una cita pasada con el importe propuesto sin motivo funciona, y copia el IVA;
  - una cita futura da `appointment_not_started`;
  - un importe distinto sin motivo da `note_required`, y con motivo funciona;
  - 0 € con motivo funciona;
  - -1 da `invalid_amount`;
  - una cita cancelada sin motivo da `appointment_cancelled_needs_note`;
  - un segundo cobro da `already_paid`;
  - anular y volver a cobrar funciona;
  - `suggested_amount` con señal pagada (poniendo `payment_status` con `service_role`) resta la señal;
  - una empleada anula un cobro suyo de hoy, pero no uno de otra (`not_allowed`) ni uno suyo de ayer (poniendo `collected_at` con `service_role`);
  - la propietaria anula cualquiera;
  - anular sin motivo da `reason_required`; anular dos veces da `already_voided`;
  - `anon`, un paciente y una sesión aal1 no leen `payments` ni ejecutan las funciones;
  - no se puede borrar una cita con cobros (`23503`).
- [ ] **Step 2: migración, `make db.reset`, `make db.types`, tests en verde. Step 3: commit**

```bash
git commit -m "Registrar y anular cobros de citas en la base de datos"
```

---

### Task 2: Reglas puras de cobros en el panel

**Files:**
- Create: `apps/dashboard/lib/payments.ts`, `apps/dashboard/lib/payments.test.ts`

**Interfaces:**
- Produces:
  - `parseAmount(input: string)` → `{ cents: number } | { error: "Escribe un importe válido." }`: acepta "45", "45,5", "45,50", "45.50" y "1.000,00"; rechaza vacío, negativos, texto y más de dos decimales.
  - `formatEuros(cents: number)` → `"45,00 €"`.
  - `methodLabel(method)`: Efectivo, Tarjeta, Bizum, Transferencia.
  - `paymentStatus({ appointment, payment, now })` → `{ kind: "paid" | "free" | "pending" | "future", label: string }`:
    - "Pagada · Efectivo · 45,00 €";
    - "Sin cobro · <motivo>" si es 0 €;
    - "Pendiente de cobro";
    - `future` sin texto.
  - `totalsByMethod(payments)` → `{ method, cents }[]` más el total, solo con los cobros vigentes.
  - `paymentHistoryLines(payment)` → líneas "Cobrada · 45,00 € · Efectivo por <nombre> el dd/mm a las HH:MM" y "Cobro anulado · <motivo> por <nombre> el dd/mm a las HH:MM", en hora de Madrid.
  - `paymentError(error)`:
    - `already_paid` → "Esta cita ya está cobrada.";
    - `note_required` → "Indica el motivo del cambio de importe.";
    - `appointment_cancelled_needs_note` → "Indica por qué se cobra una cita cancelada.";
    - `appointment_not_started` → "Todavía no se puede cobrar esta cita.";
    - `invalid_amount` → "Escribe un importe válido.";
    - `reason_required` → "Indica el motivo de la anulación.";
    - `not_allowed` → "Solo puede anular este cobro quien lo registró hoy o la propietaria.";
    - `already_voided` → "Este cobro ya está anulado.";
    - resto → "No se ha podido guardar. Inténtalo de nuevo.".

- [ ] **Step 1: tests que fallan** (incluidos los importes raros de la Review Focus 2 y un cobro a las 23:30 del día de cambio de hora). **Step 2: implementar. Step 3: commit**

```bash
git commit -m "Reglas de cobros: importes, estados, totales y mensajes"
```

---

### Task 3: Cobrar y anular desde el panel de la cita

**Files:**
- Modify:
  - el panel de la cita de la agenda (`apps/dashboard/app/(app)/agenda/AppointmentPanel.tsx`) y su carga;
  - el historial (`apps/dashboard/lib/appointment-history.ts`), que combina los eventos de la cita con los de sus cobros;
  - `apps/dashboard/app/(app)/appointments/actions.ts` o un `payments/actions.ts` nuevo (+ tests).
- Create: `e2e/payments.spec.ts`

**Interfaces:**
- Produces:
  - estado de cobro (`appointment-payment-status`) en el panel;
  - "Cobrar" (`payment-collect`) abre el formulario (`payment-form`) con:
    - importe propuesto (`payment-amount`);
    - forma de pago en un grupo de radios (`payment-method-<method>`), con efectivo marcado;
    - motivo (`payment-note`), visible y obligatorio si el importe cambia o la cita está cancelada;
    - "Registrar cobro" (`payment-submit`), bloqueado mientras envía;
  - "Anular cobro" (`payment-void`) con `ConfirmDialog` y motivo (`payment-void-reason`), solo si `canVoid`, que en el cliente es quien cobró el mismo día o la propietaria;
  - errores con `payment-error` y `paymentError`.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** acciones.
  - **e2e:** con una profesional de usar y tirar y una cita pasada creada con la clave de servicio:
    - cobrar en efectivo → "Pagada · Efectivo · …" y la línea en el historial;
    - cambiar el importe sin motivo → error, y con motivo → funciona;
    - anular con motivo → "Pendiente de cobro" → cobrar de nuevo con Bizum;
    - una cita futura no muestra "Cobrar";
    - dos pestañas cobran la misma cita → una ve "Esta cita ya está cobrada.".
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Cobrar y anular cobros desde el panel de la cita"
```

---

### Task 4: Página de cobros del día

**Files:**
- Create: `apps/dashboard/app/(app)/cobros/page.tsx` (+ componentes), `apps/dashboard/lib/payments-load.ts` (+ test si hay lógica)
- Modify: `apps/dashboard/app/(app)/layout.tsx` (menú "Cobros"), `e2e/payments.spec.ts`

**Interfaces:**
- Produces:
  - `/cobros?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&profesional=<uuid>`: por defecto, hoy en Madrid;
  - flechas "Día anterior" y "Día siguiente" (`payments-prev-day` y `payments-next-day`) cuando el rango es de un día;
  - tabla (`payments-list`) con hora, paciente (enlace a la ficha), servicio, profesional, importe, forma, quién cobró y "Anulado" si lo está;
  - totales (`payments-totals`) por forma de pago y el total, solo de los vigentes;
  - rango máximo de 92 días. Un rango inválido vuelve a hoy.

- [ ] **Step 1: tests que fallan.**
  - **e2e:** dos cobros de hoy (efectivo y tarjeta) y uno anulado → los totales por forma de pago cuadran y el anulado se ve pero no suma; el filtro por profesional funciona.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Ver los cobros del día y su total por forma de pago"
```

---

### Task 5: Pendientes de cobro

**Files:**
- Create: `apps/dashboard/app/(app)/cobros/pendientes/page.tsx`
- Modify: `e2e/payments.spec.ts`, el enlace desde `/cobros`

**Interfaces:**
- Produces:
  - `/cobros/pendientes` (`payments-pending`) muestra las citas no canceladas, ya empezadas, de los últimos 60 días, sin cobro vigente, de la más antigua a la más reciente;
  - cada fila lleva fecha y hora, paciente, servicio, profesional, importe propuesto y "Cobrar", que abre la cita en la agenda (`?date=…&appointment=…`);
  - sin pendientes: "No hay citas pendientes de cobro".

- [ ] **Step 1: tests que fallan.**
  - **e2e:** una cita pasada sin cobro aparece; al cobrarla desaparece; una cancelada no aparece.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Listar las citas pendientes de cobro"
```
