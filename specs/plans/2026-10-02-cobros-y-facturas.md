# Cobros y facturas sin atascos · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los hallazgos de cobros y facturas de la auditoría.

**Architecture:** Funciones SQL de cobros y facturas (migraciones nuevas sobre sus últimas definiciones), acciones y pantallas del panel (agenda, cobros, facturas, ficha) y del admin (Facturación y Excel).

**Tech Stack:** Supabase (Postgres, RLS, pgTAP), Next.js 16, `@clinicalumia/invoices`, exceljs, Vitest, Playwright.

**Spec:** `specs/2026-10-02-cobros-y-facturas-design.md`

## Global Constraints

- Migraciones nuevas con prefijo `202610100900xx_` en adelante; cada función se recrea desde su última definición (buscar en todas las migraciones).
- La numeración de facturas sigue sin huecos y la cadena Verifactu intacta: cualquier emisión nueva pasa por las funciones existentes de serie y registro.
- Privacidad: la propietaria lo ve todo; una empleada solo sus citas o los cobros que registró.
- Reglas de la casa: textos en español, sin comentarios, `data-testid` > rol > texto, TDD, un commit por tarea con el título exacto, nunca `--no-verify`, nunca push.
- Gates: `make lint`, `make typecheck`, `make test`, `make test.db`; e2e solo enfocado por el implementador, completo por el controlador; candado compartido de e2e.

## Review Focus

1. **Factura completa directa de más de 400 €:** numeración y cadena Verifactu correctas, sin simplificada intermedia. Tarea 1.
2. **Mover una cita facturada:** la factura no cambia y no se puede mover a otra persona ni a otro servicio. Tarea 2.
3. **Corregir destinatario:** la rectificativa y la nueva completa en una transacción; si una falla, no queda ninguna. Tarea 3.
4. **No presentada que libera la franja y luego se deshace:** no deja dos citas solapadas. Tarea 4.
5. **Totales por periodo con anulaciones cruzadas:** Cobros y Facturación cuadran en cada trimestre. Tarea 5.

---

### Task 1: Cobros de más de 400 € con factura completa

**Files:** migración (`collect_payment` con destinatario opcional y emisión de completa), `PaymentForm` (datos del destinatario cuando el importe supera 400 €), mensajes, pgTAP, unitarias, e2e.

- [ ] **Tests:** pgTAP (más de 400 € sin destinatario → error claro; con destinatario → completa con número de la serie principal y registro Verifactu); e2e (cobrar 450 € con destinatario). **Commit:** "Cobrar más de 400 € con factura completa directa"

---

### Task 2: Cambiar o cancelar una sesión ya cobrada

**Files:** migración (el bloqueo de mover citas facturadas permite cambiar fecha y hora, no persona ni servicio; historial), panel de la cita (`MoveForm`, `CancelDialog` con «Emitir rectificativa y cancelar»), ficha («Factura emitida el …»), mensaje de quién cobra, «Nueva cita» en hora pasada pide confirmación, pgTAP, e2e.

- [ ] **Tests:** pgTAP (mover cobrada permitido; cambiar paciente o servicio de una cobrada rechazado); e2e (mover cobrada, cancelar cobrada con rectificativa en un paso, aviso de hora pasada). **Commit:** "Cambiar o cancelar una sesión ya cobrada sin llamar a la propietaria"

---

### Task 3: Corregir una factura completa en un paso

**Files:** migración (función que emite rectificativa + nueva completa con nuevos datos en una transacción, mismos permisos que la rectificativa), detalle de factura («Corregir destinatario», «Para:» y título único), formulario de completa precargado con la última completa del paciente, «Rectificar» desde el panel de la cita, email de factura guardado en la ficha, pgTAP, e2e.

- [ ] **Tests:** pgTAP (atomicidad, numeración, permisos); e2e (corregir destinatario: rectificativa + nueva completa, el cobro sigue válido; precarga; guardar email en ficha). **Commit:** "Corregir el destinatario de una factura completa en un paso"

---

### Task 4: No presentadas

**Files:** migración (restricción de solapes de profesional sin `no_show`, `_free_slots`/`agenda_busy`/`pending_payments` sin `no_show`, deshacer no presentada comprueba solape), panel (Pendientes y «Registrar cobro»), pgTAP, e2e.

- [ ] **Tests:** pgTAP (franja libre tras no presentada, deshacer con conflicto rechazado, fuera de pendientes); e2e (no presentada desaparece de Pendientes; se puede dar la franja a otro). **Commit:** "Liberar la franja y sacar de pendientes las citas no presentadas"

---

### Task 5: Cobros, Facturación y Excel cuadran

**Files:** migración (`payment_totals`/`list_payments` con anulaciones en su fecha), Cobros (filas de anulación negativas), admin `ledgerRows`/Excel («Rectificada por …»), nota de Facturación, agenda (icono de estado de cobro), orden de Pendientes, pgTAP, unitarias, e2e.

- [ ] **Tests:** pgTAP (totales por periodo con anulación cruzada); unitarias (estado en Excel, nota); e2e (anulación en su fecha; icono en la agenda; Excel con «Rectificada por»). **Commit:** "Hacer que Cobros, Facturación y el Excel cuadren con las anulaciones"
