# Pieza 4a — Cobros en clínica · Diseño

Fecha: 2026-09-30 · Estado: aprobado en conversación

Es la primera parte de la pieza 4 de la plataforma LUMIA v1 (`specs/2026-09-25-plataforma-lumia-v1-design.md`). Cubre registrar en el panel lo que se cobra en la clínica. El cobro online con TPV (señal al reservar, enlaces de cobro y devoluciones) llega en la 4b, cuando esté elegido el TPV. Depende de la pieza 3a (citas).

## 1. Objetivo

Que el equipo registre el cobro de cada sesión al terminarla, vea qué hay en caja cada día y no se le escape ninguna cita sin cobrar. Los cobros quedan listos para facturar (pieza 5).

**Éxito:**
- cobrar una cita lleva un clic, con el importe ya rellenado;
- ningún cobro se borra: los errores se anulan con motivo y queda rastro;
- el total del día por forma de pago cuadra con la caja;
- las citas pasadas sin cobrar se ven en un listado.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Cuándo se cobra | Al terminar cada sesión, desde la cita. No hay pagos agrupados de varias citas ni bonos en esta pieza. |
| Importe | Se propone el precio de la cita (`appointments.price_cents`) menos la señal pagada online, si la hay (`payment_status = 'paid'` y `payment_amount_cents`). Se puede cambiar; si no coincide con el propuesto, el motivo es obligatorio. Se admite 0 € con motivo ("Sin cobro"). |
| Formas de pago | Efectivo, tarjeta (datáfono), Bizum y transferencia. |
| Qué citas se cobran | Solo las que han empezado (`starts_at <= now()`): programadas o marcadas como "no se presentó". Una cita cancelada solo se cobra con motivo, por ejemplo una cancelación tardía. Una cita futura no se cobra. |
| Un cobro por cita | Como máximo un cobro vigente por cita. Anularlo permite registrar otro. |
| Anular | Un cobro no se borra ni se edita. Se anula con motivo obligatorio. Puede anularlo quien lo registró el mismo día (hora de Madrid), y la propietaria siempre. |
| IVA | El cobro copia el tratamiento de IVA de la cita (`exempt` o `standard_21`) para la futura factura. |
| Quién cobra | Cualquier miembro activo del equipo con 2FA. |
| Online | Por la web solo se cobrará la señal (fija o porcentaje), cuando llegue el TPV. |

## 3. Datos

- **Enum `payment_method`:** `cash`, `card`, `bizum`, `transfer`.
- **Tabla `payments`:**
  - `id`, `appointment_id` (→ `appointments`, `on delete restrict`), `amount_cents` (integer ≥ 0), `method`, `vat` (`vat_treatment`), `note` (motivo, obligatorio si el importe no coincide con el propuesto o la cita está cancelada);
  - `collected_at` (default `now()`), `collected_by` (→ `profiles`);
  - `voided_at`, `voided_by`, `void_reason`.
  - Un índice único parcial `(appointment_id) where voided_at is null` garantiza un solo cobro vigente por cita.
  - RLS: `select` para `is_active_staff()`. Nadie escribe directamente: todo pasa por funciones.
- **Funciones** (todas `security definer`, `search_path = ''`, solo personal activo con aal2):
  - `collect_payment(p_appointment_id uuid, p_amount_cents int, p_method payment_method, p_note text)` → `uuid`. Valida y registra `collected_by = auth.uid()`. Errores:
    - `appointment_not_started` (la cita es futura);
    - `appointment_cancelled_needs_note` (cita cancelada sin motivo);
    - `note_required` (importe distinto del propuesto sin motivo);
    - `already_paid` (ya tiene un cobro vigente);
    - `invalid_amount` (importe negativo).
  - `void_payment(p_payment_id uuid, p_reason text)` → `void`. Errores:
    - `reason_required` (motivo vacío);
    - `not_allowed` (no lo registró esa persona hoy, o no es la propietaria);
    - `already_voided`.
  - `suggested_amount(p_appointment_id)` → `int`: el precio menos la señal pagada online, nunca por debajo de 0.

## 4. Panel

- **Panel de la cita**, en el lateral de la agenda y en la ficha:
  - **Estado de cobro:** "Pagada · <forma> · <importe>", "Sin cobro · <motivo>", "Pendiente de cobro" (cita ya empezada sin cobro vigente) o nada (cita futura).
  - **"Cobrar":** un formulario con el importe propuesto, la forma de pago (con efectivo marcado de inicio), el motivo cuando hace falta y "Registrar cobro". El envío doble se bloquea.
  - **"Anular cobro":** con un diálogo de confirmación y el motivo; solo aparece si la persona puede anularlo.
  - **Historial de la cita:** "Cobrada · <importe> · <forma> por <nombre> el dd/mm a las HH:MM" y "Cobro anulado · <motivo> por <nombre>".
- **Menú "Cobros"** (`/cobros`):
  - día seleccionado, hoy por defecto, con flechas para cambiar de día o un rango de fechas;
  - filtro por profesional;
  - tabla con hora, paciente, servicio, profesional, importe, forma de pago, quién cobró y estado (vigente o anulado);
  - **totales vigentes por forma de pago** y el total general.
- **"Pendientes de cobro"** (`/cobros/pendientes`): citas ya empezadas sin cobro vigente, de las no canceladas de los últimos 60 días, ordenadas de la más antigua a la más reciente, con "Cobrar" en cada fila.

## 5. Seguridad

- Solo el personal activo con 2FA ve y registra cobros. Los pacientes no ven nada de cobros en esta pieza.
- Los importes y el IVA los valida la base de datos. El cliente solo propone.
- No se borran cobros (`on delete restrict` y sin permisos de `delete`), y se anulan con rastro.

## 6. Pruebas

- **pgTAP:**
  - cada error de `collect_payment` y de `void_payment`;
  - un solo cobro vigente, y anular permite otro;
  - la propietaria anula cualquier cobro; la empleada, solo los suyos del día;
  - un paciente o `anon` no lee ni escribe;
  - `suggested_amount` con y sin señal pagada;
  - el IVA copiado de la cita.
- **Vitest:** acciones, textos de estado, totales por forma de pago y líneas de historial.
- **e2e:**
  - cobrar una cita pasada en efectivo desde la agenda → "Pagada" y en `/cobros` con el total;
  - cambiar el importe exige motivo;
  - anular y volver a cobrar;
  - la cita pasada sin cobro aparece en "Pendientes de cobro" y desaparece al cobrarla;
  - una cita futura no tiene "Cobrar".

## 7. Fuera de esta pieza

- Facturas y PDF (pieza 5).
- Cobro online con TPV, enlaces de cobro y devoluciones (4b).
- Bonos, pagos de varias sesiones juntas y cobros parciales.
- Cierre de caja con arqueo firmado.
