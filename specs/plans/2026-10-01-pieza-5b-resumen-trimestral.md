# Pieza 5b · Resumen trimestral y exportación · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que la propietaria vea en el admin el resumen de un trimestre y descargue el libro de facturas en Excel y un ZIP con los PDF.

**Architecture:** Lógica pura en `apps/admin/lib/quarter*.ts` (límites, agregación, filas del libro); generación de archivos en rutas de `apps/admin/app/facturacion/...`; PDF con `@clinicalumia/invoices`; ZIP subido a un bucket privado nuevo y servido con URL firmada.

**Tech Stack:** Next.js 16 (admin), Supabase (RLS, Storage), `exceljs`, `fflate`, `@clinicalumia/invoices`, Vitest, pgTAP, Playwright.

**Spec:** `specs/2026-10-01-pieza-5b-resumen-trimestral-design.md`

## Global Constraints

- Todo el acceso pasa por `is_owner()`; lectura con el cliente de la sesión y RLS, nunca `service_role` en las rutas.
- Sin cambios en `invoices`, `invoice_records` ni Verifactu. La única migración crea el bucket `exports` y sus políticas, y se aplica igual en dev y prod.
- Fechas en Europe/Madrid; los límites del trimestre son `[inicio, inicio del siguiente)`.
- Las facturas `status = 'replaced'` salen en el libro y el ZIP pero no suman en los totales; las rectificativas restan.
- Importes en céntimos (enteros) hasta el último paso; en el Excel, números con formato `#,##0.00 €`.
- Nombres: `LUMIA-facturas-{año}-T{n}.xlsx` / `.zip`; PDF `{código con / → -}.pdf`.
- Reglas de la casa: textos en español, sin comentarios, `data-testid` > rol > texto, TDD, commits pequeños con título en español sin cuerpo, nunca `--no-verify`.
- Gates: `make lint` (0 avisos), `make typecheck`, `make test`, `make test.e2e` dos veces. Comandos con `export PATH="$HOME/.orbstack/bin:$PATH"` y vigilando el reloj de Docker.

## Review Focus

1. **Factura justo en el límite** (31/03 23:30 Madrid, días de cambio de hora): cae en el trimestre correcto. Tests en la Tarea 1.
2. **Sustituidas y rectificativas:** los totales del resumen, del Excel y del ZIP coinciden y no duplican. Tests en las Tareas 1 y 3.
3. **Trimestre grande:** el ZIP de varios MB se descarga (URL firmada, sin límite de 4,5 MB). Test en la Tarea 4.
4. **Una empleada o un anónimo** no pueden leer el bucket ni llamar a las rutas. Tests en las Tareas 2 y 4.
5. **Factura con líneas de IVA distinto:** una fila por tipo en el libro y totales correctos. Tests en las Tareas 1 y 3.

---

### Task 1: Trimestres y agregación

**Files:** `apps/admin/lib/quarter.ts`, `apps/admin/lib/quarter-summary.ts` (+ tests).

**Produces:**
- `quarterRange(year, q): { from: string; to: string }` con instantes ISO de los límites en Madrid;
- `lastClosedQuarter(now): { year; q }` y `isCurrentQuarter`;
- `summarizeInvoices(invoices): QuarterSummary` (recuentos por tipo y estado; base, cuota y total por `vat_rate`; neto);
- `ledgerRows(invoices): LedgerRow[]` (una fila por factura y tipo de IVA, con las columnas de la spec §4);
- `exportFileName(year, q, ext)` y `pdfFileName(code)`.

- [ ] **Tests:** límites (29/03, 25/10, 31/03 23:30, 31/12 23:59), agregación con sustituida + completa + rectificativa + líneas mixtas, filas del libro. **Commit:** "Calcular el resumen de un trimestre de facturas"

---

### Task 2: Bucket privado de exportaciones

**Files:** migración `packages/db/supabase/migrations/20261005090000_exportaciones.sql`, test pgTAP, tipos de `@clinicalumia/db` si cambian.

**Produces:** bucket `exports` privado (`application/zip`, límite 200 MB); políticas: la propietaria lee, escribe y borra solo `{auth.uid()}/...`; nadie más.

- [ ] **Tests:** pgTAP (propietaria sí en su carpeta, no en otra; empleada y anónimo no). **Commit:** "Crear el almacenamiento privado de exportaciones"

---

### Task 3: Página Facturación y Excel

**Files:** `apps/admin/app/(admin)/facturacion/page.tsx` (+ selector de trimestre), navegación del admin, `apps/admin/lib/quarter-load.ts`, `apps/admin/lib/ledger-xlsx.ts`, ruta `apps/admin/app/facturacion/excel/route.ts`, `exceljs`, e2e.

**Produces:**
- página con selector (año, T1–T4; por defecto el último cerrado), aviso de trimestre en curso, recuentos, tabla por IVA, neto y estado vacío;
- `GET /facturacion/excel?year=&q=` devuelve el `.xlsx` (hojas «Facturas» y «Resumen»);
- botón «Descargar Excel» (`quarter-download-xlsx`).

- [ ] **Tests:** unitarios del xlsx (se lee con `exceljs` y se comprueban filas y totales); e2e (resumen visible, descarga del Excel, una empleada no entra, parámetros inválidos → 400). **Commit:** "Ver el resumen trimestral y descargar el libro de facturas"

---

### Task 4: ZIP con los PDF

**Files:** `apps/admin/app/facturacion/zip/route.ts` (`maxDuration = 300`), `apps/admin/lib/quarter-zip.ts`, `next.config` del admin (igual que el panel para `@clinicalumia/invoices`), `fflate`, e2e.

**Produces:**
- `POST /facturacion/zip` con `year` y `q`: genera los PDF y el Excel, crea el ZIP, borra los ZIP anteriores de la propietaria, lo sube a `exports/{uid}/{uuid}.zip` y responde con una URL firmada de 10 minutos;
- botón «Descargar PDF (ZIP)» (`quarter-download-zip`) con estado «Preparando…» y error en español.

- [ ] **Tests:** unitarios (nombres dentro del ZIP, un PDF por factura más el Excel); e2e (descarga, se abre el ZIP, nº de PDF = nº de facturas; un ZIP anterior desaparece al generar otro; una empleada recibe 403). **Commit:** "Descargar los PDF del trimestre en un ZIP"
