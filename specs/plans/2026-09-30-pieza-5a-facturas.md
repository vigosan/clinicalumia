# Pieza 5a — Facturas · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emitir la factura simplificada de cada cobro y, bajo petición, la completa o una rectificativa. Todo con numeración correlativa configurable, huella Verifactu encadenada y QR, PDF minimalista con el estilo de LUMIA, listado, impresión y envío por email.

**Architecture:**
- **Base de datos:** series, facturas inmutables con los datos congelados y un registro Verifactu con la cadena de huellas. La numeración y la huella se generan dentro de las funciones, con bloqueo.
- **Paquete `@clinicalumia/invoices`:** el documento PDF (`@react-pdf/renderer`), las fuentes TTF, el QR y los textos, compartido por el panel y, en el futuro, por Mi cuenta.
- **Panel:** la factura en el cobro, `/facturas`, la ficha del paciente y el email.
- **Admin:** la configuración de las series.

**Tech Stack:** Supabase (Postgres, pgcrypto, pgTAP) · `@react-pdf/renderer` · `qrcode` · Next.js 16 · Vitest · Playwright.

**Spec:** `specs/2026-09-30-pieza-5a-facturas-design.md`. Base: `main` 0bf4d50. Boceto aprobado: `invoice.tsx` en el scratchpad de la sesión (el controlador pasa la ruta).

## Global Constraints

- **Migraciones:** una sola nueva, `20261004090000_facturas.sql`, que se edita en el sitio mientras no salga de la rama. `make db.types` y `make db.types.check` en verde. Nada se aplica en remoto.
- **Inmutabilidad:**
  - `invoices` e `invoice_records` no se borran nunca;
  - `invoices` solo cambia `status` a `replaced`, y lo hacen las funciones;
  - `invoice_records` solo admite inserciones;
  - lo garantizan triggers y `revoke`.
- **Numeración:**
  - `invoice_series(code, format, year, next_number, locked)`;
  - el formato admite `{año}`, `{aa}`, `{n}` y `{n:K}`. El formato inicial es `{n}/{aa}` para la serie `main` y `R{n}/{aa}` para `rectifying`;
  - la numeración es sin huecos: `select … for update` de la serie dentro de la transacción del cobro o de la emisión;
  - al emitir la primera factura del año, la serie de ese año queda `locked`;
  - si llega un año nuevo sin configurar, se crea la fila del año con `next_number = 1` y el mismo formato.
- **Tipos Verifactu:** `F2` simplificada, `F3` completa que sustituye a una simplificada, `R5` rectificativa de una simplificada y `R1` rectificativa de una completa.
- **Huella (alta):** SHA-256 en mayúsculas del texto `IDEmisorFactura=<NIF>&NumSerieFactura=<código>&FechaExpedicionFactura=<dd-mm-aaaa>&TipoFactura=<tipo>&CuotaTotal=<iva>&ImporteTotal=<total>&Huella=<anterior o vacío>&FechaHoraHusoGenRegistro=<aaaa-mm-ddThh:mm:ss+hh:mm>`.
  - Los importes van con punto y 2 decimales, y los negativos con signo.
  - La fecha y hora se dan en la zona de Madrid.
  - El orden y el formato se comprueban con la especificación vigente de la AEAT: el implementador de la Tarea 1 la consulta (WebFetch de la documentación oficial) y documenta la fuente en el informe.
- **QR:** URL de cotejo de la AEAT para sistemas **no VERI\*FACTU** (el envío no está activo), con `nif`, `numserie`, `fecha` e `importe`. La URL exacta se confirma con la documentación oficial en la Tarea 3 y se guarda como constante con el `ValidarQR` correspondiente.
- **IVA:** `exempt` → base = total, IVA 0 y el texto de exención de la clínica. `standard_21` → base = round(total / 1,21), IVA = total − base.
- **Señal online:** la factura suma `appointments.payment_amount_cents` si `payment_status = 'paid'` y detalla los pagos. Hoy siempre es 0.
- **Privacidad:** la misma regla que los cobros. La propietaria ve todo; cada profesional, las facturas de citas suyas o de cobros que registró.
- **PDF:**
  - diseño minimalista del boceto aprobado;
  - Neue Haas en TTF dentro del paquete (convertida desde las WOFF2 de `packages/ui`, con la licencia de siempre);
  - código ESM en el servidor;
  - el PDF nunca se guarda: se genera al pedirlo.
- **e2e:** datos propios, limpieza completa y en paralelo. Para borrar facturas en los tests se usa un helper con la clave de servicio que desactiva el trigger, **solo en local**, o se reserva un rango de series por test. Se vigila el reloj de Docker.
- **Reglas de la casa:** textos en español; sin comentarios; `data-testid` > rol > etiqueta; commits pequeños con título descriptivo en español, sin cuerpo; nunca `--no-verify`.
- **Gates:**
  - siempre: `make lint` (0 avisos), `make typecheck`, `make test` y `make test.db`;
  - en tareas con pantallas, además `make test.e2e` dos veces.

## Review Focus

1. **Dos cobros a la vez** reciben números consecutivos distintos, sin huecos ni duplicados. Tests en la Tarea 1.
2. **Un error en mitad de la emisión** (por ejemplo, un NIF inválido en la completa) no consume número ni deja cadena rota: todo va en la misma transacción. Tests en las Tareas 1 y 2.
3. **Cambio de año:** el 1 de enero en Madrid la numeración empieza de nuevo en su serie, y una factura del 31 de diciembre a las 23:30 cuenta en ese año. Tests en la Tarea 1.
4. **Un nombre con acentos, comas o texto muy largo** no rompe el PDF ni la huella. Tests en las Tareas 1 y 3.
5. **Una profesional no ve facturas de pacientes de compañeros,** ni por listado ni por URL. Tests en las Tareas 2 y 5.

---

### Task 1: Series, factura simplificada y cadena Verifactu

**Files:**
- Create: `packages/db/supabase/migrations/20261004090000_facturas.sql`, `packages/db/supabase/tests/invoices.test.sql`
- Modify: `packages/db/types.ts`

**Interfaces:**
- Produces:
  - `invoice_series`, `invoices` e `invoice_records`, con las columnas de la spec (sección 3) y las Global Constraints;
  - `public.format_invoice_code(p_format text, p_year int, p_number int)` → `text` (inmutable, con tests);
  - `public.issue_simplified_invoice(p_payment_id uuid)` → `uuid`:
    - interna: `revoke` a `authenticated`; la llama `collect_payment`, redefinido en esta migración, cuando el total a facturar es mayor que 0;
    - congela el `snapshot` con el emisor (`clinic_settings`), la línea (servicio, fecha de la sesión, nombre corto del paciente como "Lucía M."), los totales, la nota de IVA, los pagos y el pie;
    - crea el registro `alta` con su huella.
  - Triggers de inmutabilidad y el índice único de `invoice_records.previous_hash`. El primer registro usa `previous_hash = ''`.

- [ ] **Step 1: pgTAP que falla.**
  - `format_invoice_code` con `{n}/{aa}`, `R{n}/{aa}`, `F{año}-{n:4}`;
  - un formato sin `{n}` es inválido;
  - cobrar emite la factura `F2`, con código "1/26" (o el `next_number` configurado) y `snapshot` correcto, tanto exenta como al 21 % (base e IVA);
  - un cobro de 0 € sin señal no emite factura;
  - dos cobros seguidos dan números correlativos;
  - la serie queda `locked`;
  - `update` o `delete` de `invoices` o `invoice_records` dan error, también para `service_role` salvo el cambio de estado desde las funciones;
  - la huella del primer registro es igual a un SHA-256 calculado a mano en el test del texto canónico esperado, y el segundo registro encadena la huella del primero;
  - una factura del 31/12 a las 23:30 de Madrid cuenta en su año y la del 1/1 empieza la serie del año nuevo;
  - `anon`, un paciente y una sesión aal1 no leen nada.
- [ ] **Step 2: migración, reset, tipos, tests en verde. Step 3: commit**

```bash
git commit -m "Emitir la factura simplificada de cada cobro con numeración correlativa y huella Verifactu"
```

---

### Task 2: Factura completa, rectificativa y consultas

**Files:**
- Modify: `packages/db/supabase/migrations/20261004090000_facturas.sql`, `packages/db/supabase/tests/invoices.test.sql`, `packages/db/types.ts`

**Interfaces:**
- Produces:
  - `issue_full_invoice(p_invoice_id uuid, p_recipient jsonb)` → `uuid` (`F3`):
    - valida el NIF con la misma lógica que `isValidPersonalId` y admite también CIF (con tests);
    - la simplificada pasa a `replaced`;
    - errores: `invoice_not_found`, `invoice_not_simplified`, `invoice_already_replaced`, `recipient_invalid`, `recipient_tax_id_invalid`.
  - `issue_rectifying_invoice(p_invoice_id uuid, p_reason text)` → `uuid`:
    - serie `rectifying`, tipo `R5` o `R1`, `total_cents` negativo y el motivo;
    - rectifica la factura vigente del cobro (la completa si la hay) y anula el cobro (`voided_at`, `void_reason = p_reason`);
    - errores: `reason_required`, `invoice_not_found`, `invoice_already_rectified`, `not_allowed` (misma regla que `void_payment`);
  - `void_payment` redefinido: `invoice_requires_rectification` si el cobro tiene factura vigente;
  - `list_invoices(p_start, p_end, p_kind, p_query, p_professional_id, p_limit, p_offset)` → las filas del listado más `total_count`, con la regla de privacidad y paginación en la base de datos;
  - `invoice_detail(p_invoice_id)` → el `snapshot`, las relacionadas y los datos del QR, con la regla de privacidad (sin permiso, `invoice_not_found`).

- [ ] **Step 1: pgTAP que falla.** Cubre cada error, que un NIF inválido no consume número, la cadena tras varias emisiones, la privacidad (empleada A, B, propietaria, paciente, anon) y la paginación.
- [ ] **Step 2: implementar, reset, tipos, tests. Step 3: commit**

```bash
git commit -m "Emitir facturas completas y rectificativas y consultarlas con permisos"
```

---

### Task 3: Paquete del PDF de factura

**Files:**
- Create: `packages/invoices/` (`package.json` ESM, `index.ts`, `InvoiceDocument.tsx`, `fonts/*.ttf`, `qr.ts`, `format.ts`, tests)

**Interfaces:**
- Consumes: la forma de `invoice_detail` (Tarea 2).
- Produces:
  - `renderInvoicePdf(detail, { logo?: Uint8Array })` → `Promise<Uint8Array>`;
  - `invoiceQrUrl({ nif, code, issuedAt, totalCents })` → `string`;
  - `invoiceFileName(code)` → `"factura-34-26.pdf"`.
  - El diseño es el del boceto minimalista aprobado. Se reutiliza su estructura, sin textos de prueba.

- [ ] **Step 1: tests que fallan.**
  - la URL del QR (codificación de `/`, fecha dd-mm-aaaa, importe con punto);
  - el nombre del archivo;
  - `renderInvoicePdf` produce un PDF (cabecera `%PDF`) cuyo texto extraído (con `unpdf`, dependencia de desarrollo) contiene el código, el total, "Pagado con tarjeta" y el texto de exención;
  - acentos y una línea muy larga no rompen nada.
- [ ] **Step 2: implementar (fuentes TTF convertidas y comprobadas visualmente con una captura en el scratchpad). Step 3: commit**

```bash
git commit -m "Generar el PDF de factura con el estilo de LUMIA"
```

---

### Task 4: Factura en el cobro, impresión, email, completa y rectificativa

**Files:**
- Modify: el panel de la cita (`AppointmentPanel.tsx`, `PaymentForm.tsx`, `VoidPaymentDialog.tsx`) y las acciones de cobros.
- Create: `apps/dashboard/app/facturas/[id]/pdf/route.ts`, `apps/dashboard/app/(app)/facturas/actions.ts` (+ tests), `FullInvoiceForm.tsx`, `SendInvoiceDialog.tsx`, `e2e/invoices.spec.ts`

**Interfaces:**
- Produces:
  - En el panel, tras cobrar: "Factura 34/26" (`invoice-code`), "Ver / Imprimir" (`invoice-view`, abre la ruta del PDF en una pestaña), "Enviar por email" (`invoice-send`) y "Factura completa" (`invoice-full`).
  - `GET /facturas/<id>/pdf`: sesión de personal y permiso vía `invoice_detail`; si no, `404`. Devuelve `application/pdf` con `Content-Disposition: inline; filename=…` y `Cache-Control: private, no-store`.
  - **Enviar por email:** el email propuesto, el de la cuenta o la ficha del paciente o de su tutor, es editable y se valida. Se envía con `sendEmail` (Resend en producción, Mailpit en local), con el asunto "Factura <código> · Clínica LUMIA", un texto breve y el PDF adjunto. Si va bien, muestra "Factura enviada a <email>".
  - **Factura completa:**
    - formulario con nombre, NIF, dirección, código postal y ciudad, que se rellena con los datos del paciente o, si es menor, del tutor;
    - emite con `issue_full_invoice` y muestra el nuevo código.
  - **Anular un cobro facturado:** el diálogo pasa a "Emitir rectificativa y anular cobro", con motivo, y llama a `issue_rectifying_invoice`.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** las acciones.
  - **e2e:**
    - cobrar muestra el código de factura, y "Ver / Imprimir" devuelve `application/pdf`;
    - "Enviar por email" deja en Mailpit el email con el PDF adjunto;
    - "Factura completa" con NIF válido crea la completa (y con NIF inválido muestra el error);
    - anular un cobro facturado crea la rectificativa con código `R1/26` y el cobro queda anulado;
    - una profesional no puede abrir el PDF de otra (`404`).
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Ver, enviar y corregir las facturas desde el cobro"
```

---

### Task 5: Listado de facturas y apartado en la ficha

**Files:**
- Create: `apps/dashboard/app/(app)/facturas/page.tsx`, `facturas/[id]/page.tsx`, `apps/dashboard/lib/invoices-load.ts` (+ test)
- Modify: `(app)/layout.tsx` (menú "Facturas"), `patients/[id]/page.tsx` (apartado "Facturas"), `e2e/invoices.spec.ts`

**Interfaces:**
- Produces:
  - `/facturas`:
    - filtros de fechas (por defecto el mes en curso), tipo, texto y profesional (este, solo para la propietaria);
    - tabla (`invoices-list`) con código, fecha, tipo, destinatario o paciente, total y estado ("Sustituida", "Rectificada");
    - paginación de 25 con `total_count`.
  - `/facturas/<id>`: el detalle, las relacionadas y las mismas acciones que en el cobro.
  - En la ficha, el apartado "Facturas" (`patient-invoices`).

- [ ] **Step 1: tests que fallan** (unitarios de la carga y los filtros; e2e del listado, el filtro, el detalle y la ficha). **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Listar las facturas y verlas en la ficha del paciente"
```

---

### Task 6: Series de facturación en el admin

**Files:**
- Modify: `apps/admin/app/(admin)/clinic/*` (apartado "Facturación"), `apps/admin/lib/*` (+ tests), la migración (una función `set_invoice_series(p_code, p_format, p_year, p_next_number)` solo para la propietaria y solo si la serie no está `locked`), `e2e/admin-config.spec.ts`

**Interfaces:**
- Produces:
  - Por serie ("Facturas" y "Rectificativas"): el formato, el año y el siguiente número, con una vista previa ("La próxima factura será 35/26").
  - Si la serie está bloqueada: "La numeración de 2026 ya está en uso y no se puede cambiar."
  - Errores: `series_locked`, `format_invalid` y `number_invalid`.

- [ ] **Step 1: tests que fallan.**
  - **pgTAP:** la función.
  - **Unitarios:** la vista previa.
  - **e2e:** la propietaria de usar y tirar configura un número y la siguiente factura lo usa. Se restaura la serie al terminar, en una serie de prueba o con cuidado de no tocar la del seed, en el proyecto `clinic-settings` que va en serie.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Configurar la numeración de las facturas desde el admin"
```
