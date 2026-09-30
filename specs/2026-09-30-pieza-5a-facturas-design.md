# Pieza 5a — Facturas · Diseño

Fecha: 2026-09-30 · Estado: aprobado en conversación (pendiente del boceto del PDF)

Es la primera entrega de la pieza 5 de la plataforma LUMIA v1 (`specs/2026-09-25-plataforma-lumia-v1-design.md`). Cubre la emisión de facturas, su PDF, las rectificativas, el listado, la impresión y el envío por email, con Verifactu preparado. La 5b cubrirá el resumen trimestral, la exportación para la gestoría y el ZIP de PDF. Depende de la 4a (cobros).

## 1. Objetivo

Que cada cobro tenga su factura legal, con el estilo de LUMIA, sin trabajo extra para el equipo. Que se pueda emitir la factura completa cuando el paciente la pida, y que los errores se corrijan con rectificativas. Todo listo para Verifactu el día que se active el envío.

**Éxito:**
- registrar un cobro emite su factura simplificada, con la numeración correlativa que continúa la del Excel actual;
- nunca hay dos facturas con el mismo número ni huecos en una serie;
- una factura emitida no se modifica: se sustituye (completa) o se rectifica;
- el PDF se imprime y se envía por email desde el panel;
- cada factura tiene su huella Verifactu encadenada y su QR.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Cuándo se emite | Automáticamente al registrar un cobro (`collect_payment`), como **factura simplificada**. En un cobro de 0 € sin señal no se emite factura. |
| Señal online (4b) | La factura es del **servicio completo**: el importe es el cobrado en la clínica más la señal pagada online (`appointments.payment_amount_cents` con `payment_status = 'paid'`). Detalla los pagos ("Señal online: 10,00 € · Tarjeta: 35,00 €"). Si el paciente no viene y la clínica se queda la señal, "Facturar señal" en la cita emite una factura solo por la señal. Mientras no haya TPV online, la factura es la del cobro. |
| Factura completa | Bajo petición, desde una simplificada: pide los datos fiscales del destinatario (el paciente o, si es menor, su tutor: nombre, NIF y dirección) y emite una factura completa que **sustituye** a la simplificada. Es una factura nueva de la serie principal que referencia la sustituida, tipo `F3` de Verifactu. |
| Anular un cobro facturado | `void_payment` exige emitir antes una **rectificativa** por el importe completo en negativo. Es una serie aparte, tipo `R5` sobre una simplificada o `R1` sobre una completa, con su motivo. Al emitirla se anula el cobro. |
| Numeración | Configurable por serie en el admin: el formato con marcadores (`{año}` = 2026, `{aa}` = 26, `{n}` = número sin ceros, `{n:4}` = número con 4 dígitos) y el siguiente número del año en curso. **La clínica numera hoy como `número/año`, por ejemplo `34/26`, así que el formato inicial de la serie principal es `{n}/{aa}`.** Así la primera factura continúa la numeración del Excel. La serie de rectificativas es independiente. El formato y el siguiente número se bloquean para el año en curso al emitir la primera factura de ese año. Cada año vuelve a empezar por 1, salvo que se configure otro número. |
| Datos congelados | La factura guarda una copia de todo lo que imprime: emisor, destinatario, concepto (servicio, fecha de la sesión y paciente), importes, IVA o texto de exención, forma de pago y pie. No cambia aunque luego cambien los servicios, la ficha o los datos de la clínica. |
| IVA | Según el cobro: `exempt` usa el texto de exención de la clínica; `standard_21` separa base (total / 1,21, redondeado al céntimo) e IVA (total − base). |
| Verifactu | Preparado sin envío. Cada registro (alta o anulación) guarda su huella SHA-256, la huella del registro anterior, la fecha y hora de generación con zona y el contenido canónico usado para la huella. El QR apunta a la URL de cotejo de la AEAT. El envío a la AEAT (con certificado) llega en una entrega posterior. El PDF no lleva la leyenda "VERI*FACTU" mientras no se envíe. |
| PDF | `@react-pdf/renderer`, diseño **minimalista** aprobado con boceto: logo a la izquierda; "Factura simplificada 34/26" o "Factura 35/26" en letra fina con la fecha debajo en gris; emisor (y destinatario bajo un pequeño "Para") en texto pequeño; cada concepto en una línea (con la fecha de la sesión y el paciente en gris) y su importe; totales ("Total", o "Base" e "IVA 21 %" en gris pequeño y "Total"), con el total como único elemento en el color del logo; texto de exención y "Pagado con …" en gris pequeño; QR pequeño con la leyenda "Factura verificable en la sede electrónica de la AEAT" abajo a la derecha, encima del pie; y un pie de una línea (clínica · dirección · web · pie de factura) con "1 / 1". Neue Haas convertida a TTF (react-pdf no dibuja bien las WOFF2) y guardada junto a las WOFF2. Se genera al vuelo desde los datos congelados en código ESM del servidor. |
| Entrega | Desde el panel: "Ver / Imprimir" (el PDF en una pestaña) y "Enviar por email", con el email propuesto del paciente o del tutor, editable, y el PDF adjunto. No se envía sola. |
| Quién ve | La propietaria, todas. Cada profesional, las de sus citas, con la regla de privacidad de los cobros. Solo el personal activo con 2FA emite, y la propietaria emite rectificativas de cualquier factura. |
| Excel previo | Las facturas del Excel no se importan. La huella Verifactu empieza con la primera factura de la plataforma. |

## 3. Datos

- **`invoice_series`**:
  - campos: `code` (`main`, `rectifying`), `format` (por ejemplo `{n}/{aa}`, o `R{n}/{aa}` para rectificativas), `year`, `next_number`, `locked` (boolean);
  - la edita la propietaria desde el admin mientras `locked` sea falso para ese año. Un formato sin `{n}` no es válido.
- **`invoices`**:
  - `id`, `series`, `number` (entero), `code` (el número formateado, único), `kind` (`simplified`, `full`, `rectifying`), `issued_at`;
  - `payment_id` (→ `payments`), `replaces_invoice_id` (factura completa → simplificada), `rectifies_invoice_id` (rectificativa → original), `reason` (en las rectificativas);
  - los datos congelados en `snapshot jsonb`: `issuer`, `recipient` (nulo en la simplificada), `lines` (concepto, cantidad, base, tipo de IVA, IVA y total), `totals`, `vat_note`, `payment_method` y `footer`;
  - `total_cents` (negativo en las rectificativas);
  - `status`: `issued` o `replaced`. Una simplificada sustituida por una completa queda `replaced`. Una factura rectificada sigue `issued`, y su rectificativa la compensa.
  - Solo se inserta con funciones. No se actualiza salvo `status` por las funciones, y no se borra (`revoke`, y un trigger que bloquea `update` y `delete` salvo el cambio de estado desde las funciones).
- **`invoice_records`** (registro Verifactu, solo inserción):
  - `id`, `invoice_id`, `kind` (`alta`, `anulacion`), `generated_at` (timestamptz), `previous_hash`, `hash` (SHA-256 en hexadecimal y mayúsculas), `canonical` (el texto que se firma), `sent_at` (nulo) y `aeat_status` (nulo);
  - un índice único sobre `previous_hash` garantiza una sola cadena.
- **Funciones** (`security definer`, `search_path = ''`, personal activo con aal2):
  - `issue_simplified_invoice(p_payment_id)`, llamada dentro de `collect_payment` cuando el importe es mayor que 0. Numera con `select … for update` sobre la serie (sin huecos), congela los datos, crea el registro de alta y bloquea la serie para el año.
  - `issue_full_invoice(p_invoice_id, p_recipient jsonb)`, donde `p_recipient` es `{name, tax_id, address, postal_code, city}`. El NIF se valida como DNI, NIE o CIF, y la función marca la simplificada como `replaced`.
  - `issue_rectifying_invoice(p_invoice_id, p_reason)`, que después anula el cobro.
  - `void_payment` se cambia: si el cobro tiene una factura vigente, da `invoice_requires_rectification`.
  - `invoice_pdf_data(p_invoice_id)` devuelve el `snapshot` más los datos del QR, con la regla de visibilidad.
- **Huella** (Verifactu, alta): SHA-256 del texto `IDEmisorFactura=<nif>&NumSerieFactura=<code>&FechaExpedicionFactura=<dd-mm-aaaa>&TipoFactura=<F2|F1|F3|R1|R5>&CuotaTotal=<iva con 2 decimales>&ImporteTotal=<total con 2 decimales>&Huella=<huella anterior o vacío>&FechaHoraHusoGenRegistro=<ISO 8601 con zona>`. Es el orden de campos publicado por la AEAT, que se revisará con la especificación vigente en el plan. Se calcula en la base de datos con `extensions.digest`.

## 4. Panel

- **Cobro** (panel de la cita): tras cobrar, se ve "Factura 34/26" con los botones "Ver / Imprimir", "Enviar por email" y "Factura completa". "Anular cobro" pasa a pedir el motivo de la rectificativa si el cobro está facturado.
- **"Facturas"** en el menú (`/facturas`):
  - listado con número, fecha, tipo, destinatario o paciente, total y estado;
  - filtros por fechas, tipo, texto (número o nombre) y profesional (este último solo para la propietaria);
  - paginación en la base de datos, sin el límite de 1.000 filas.
- **Detalle** (`/facturas/<id>`): los datos congelados, las facturas relacionadas (sustituye a / sustituida por / rectifica a / rectificada por) y las acciones.
- **Enviar por email:** el email propuesto (de la cuenta o la ficha del paciente o del tutor), editable. Asunto "Factura <código> · Clínica LUMIA", un texto breve y el PDF adjunto. Cada envío queda registrado.
- **Ficha del paciente:** apartado "Facturas".

## 5. Admin

- **"Datos de la clínica → Facturación":** los datos fiscales que ya existen (razón social, NIF, dirección, texto de exención y pie) más las series: formato, año y siguiente número de cada una, con una vista previa del próximo número. Si la serie ya está bloqueada, se explica por qué no se puede cambiar.

## 6. Seguridad y legalidad

- Las facturas no se modifican ni se borran. Los errores se corrigen con rectificativas.
- La numeración se asigna dentro de la transacción del cobro, con bloqueo de la serie, así que no puede haber duplicados ni huecos.
- La cadena de huellas es única. Una huella mal encadenada no se puede insertar.
- Los PDF se generan en el servidor para personal autorizado y no se guardan públicamente.

## 7. Pruebas

- **pgTAP:**
  - numeración correlativa, también con dos cobros a la vez;
  - bloqueo de la serie;
  - formato y siguiente número;
  - completa: sustituye y valida el NIF;
  - rectificativa: importe negativo y anula el cobro;
  - `void_payment` con factura da `invoice_requires_rectification`;
  - las facturas no se pueden actualizar ni borrar;
  - la cadena de huellas, contrastada con un ejemplo calculado a mano;
  - la visibilidad.
- **Vitest:** formato de numeración, cálculo de base e IVA, texto canónico de la huella, datos del QR y el PDF generado (se comprueba que contiene los textos clave).
- **e2e:**
  - cobrar → aparece la factura → "Ver / Imprimir" devuelve un PDF;
  - "Enviar por email" → llega a Mailpit con el PDF adjunto;
  - factura completa con NIF;
  - anular un cobro facturado → rectificativa;
  - el admin configura la serie y la primera factura usa ese número.

## 8. Fuera de esta entrega

- Resumen trimestral, exportación y ZIP (5b).
- Envío a la AEAT con certificado (entrega de Verifactu).
- Facturas en Mi cuenta.
- Facturas agrupadas, a mutuas o empresas con retención (v2).
