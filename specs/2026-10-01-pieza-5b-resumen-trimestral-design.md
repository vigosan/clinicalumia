# Pieza 5b · Resumen trimestral y exportación para la gestoría · Diseño

Fecha: 2026-10-01 · Estado: aprobado en conversación

Es la segunda entrega de la pieza 5 de la plataforma LUMIA v1 (`specs/2026-09-25-plataforma-lumia-v1-design.md`). Depende de la 5a (`specs/2026-09-30-pieza-5a-facturas-design.md`): usa sus facturas, su snapshot inmutable y su paquete de PDF `@clinicalumia/invoices`.

## 1. Objetivo

Al cerrar un trimestre, la propietaria entra en el admin, elige el trimestre, revisa los totales y descarga dos archivos que envía ella misma a la gestoría:

- un Excel con el libro de facturas emitidas del trimestre;
- un ZIP con el PDF de cada factura.

**Éxito:**
- los totales del resumen, los del Excel y la suma de los PDF coinciden;
- una factura cuenta en el trimestre de su fecha de emisión en hora de Madrid;
- un trimestre grande se descarga sin error.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Entrega | Se descarga y la propietaria la envía. Sin envío por email ni acceso para la gestoría. |
| Dónde | En el admin, que solo usa la propietaria. Entrada nueva «Facturación» en la navegación, ruta `/facturacion`. |
| Trimestre | Selector de año y trimestre (T1–T4). Por defecto, el último trimestre cerrado. También se puede ver el que está en curso, con un aviso «Trimestre en curso: los datos pueden cambiar». |
| Fechas | Límites en Europe/Madrid: T1 del 1 de enero 00:00 al 1 de abril 00:00 (sin incluir), y así sucesivamente. Se compara con `invoices.issued_at`. |
| Formato | Excel (`.xlsx`), no CSV: el CSV da problemas de acentos y decimales en el Excel español. Importes como números con formato `#,##0.00 €`. |
| ZIP | Se genera en el servidor, se sube a un bucket privado y se descarga con una URL firmada de 10 minutos. Así no choca con el límite de 4,5 MB de respuesta de Vercel. |
| Sustituidas | Cuando una completa sustituye a una simplificada, las dos aparecen en el libro y en el ZIP, pero en los totales suma siempre la simplificada original y la completa no suma (mismo cobro, mismo importe). Así un trimestre ya presentado no cambia si la completa se emite más tarde. **A validar con la gestoría.** |
| Rectificativas | Aparecen con importes negativos y restan en los totales. |

## 3. Resumen en pantalla

- Número de facturas: simplificadas, completas, rectificativas y sustituidas.
- Una tabla por tratamiento de IVA (exento, 21 %): base, cuota y total.
- Total neto del trimestre.
- Botones «Descargar Excel» y «Descargar PDF (ZIP)». Si el trimestre no tiene facturas, se muestra un estado vacío y los botones no aparecen.

Los totales salen de los `snapshot.lines` de cada factura (`base_cents`, `vat_rate`, `vat_cents`, `total_cents`), agrupados por `vat_rate`. Las facturas completas que sustituyen a una simplificada (`replaces_invoice_id` no nulo) no suman; la simplificada sustituida sí.

## 4. Excel

**Hoja «Facturas»**, una fila por factura, ordenada por fecha de emisión y número:

| Columna | Origen |
|---------|--------|
| Fecha | `issued_at` en Madrid, `dd/mm/aaaa` |
| Número | `code` |
| Tipo | Simplificada / Completa / Rectificativa |
| Sustituye a / Rectifica a | código de la factura relacionada |
| Estado | Emitida / Sustituida por {código} |
| Cliente | `snapshot.recipient.name` o «Consumidor final» si es simplificada sin destinatario |
| NIF | `snapshot.recipient.tax_id` |
| Concepto | descripciones de las líneas, separadas por « · » |
| Base | suma de `base_cents` |
| % IVA | 0 o 21 (si hay líneas con tipos distintos, una fila por tipo con el mismo número) |
| Cuota IVA | suma de `vat_cents` |
| Total | `total_cents` |
| Suma en totales | «No» solo para una completa que sustituye a una simplificada; «Sí» en el resto |
| Exención | `snapshot.vat_note` cuando el IVA es 0 |
| Forma de pago | `snapshot.payments` (Efectivo, Tarjeta, Bizum, Transferencia) |

**Hoja «Resumen»:** el trimestre, el emisor (nombre y NIF), los totales por tipo de IVA y el total neto, igual que en pantalla, y una nota que explica que las rectificativas restan y que la completa que sustituye a una simplificada no suma.

El nombre del archivo es `LUMIA-facturas-2026-T3.xlsx`.

## 5. ZIP

- Un PDF por factura, generado con `@clinicalumia/invoices` desde el snapshot, idéntico al que se descarga en el panel.
- Nombre de cada PDF: el código con `/` cambiado por `-` (`1347-26.pdf`, `R3-26.pdf`).
- El ZIP incluye también el Excel.
- Nombre del ZIP: `LUMIA-facturas-2026-T3.zip`.
- Bucket privado `exports`, ruta `{user_id}/{uuid}.zip`, solo la propietaria puede leer. Al generar uno nuevo se borran los anteriores de esa persona.
- La ruta tiene `maxDuration = 300`.

## 6. Seguridad y datos

- Todo pasa por `is_owner()` (aal2 y sesión viva). Una empleada no tiene acceso al admin ni a las rutas de exportación.
- Lectura con el cliente de la sesión y RLS, sin `service_role`.
- Sin cambios en las facturas ni en Verifactu. La única migración nueva crea el bucket `exports` y sus políticas.
- Los archivos contienen datos personales de pacientes: la URL firmada caduca a los 10 minutos y los ZIP se borran al generar el siguiente.

## 7. Pruebas

- **Unitarias:** límites del trimestre en Madrid (incluidos el 29/03/2026 y el 25/10/2026, cambios de hora, y el 31/03 23:30); agregación por IVA con rectificativas, sustituidas y líneas con tipos distintos; nombres de archivo.
- **pgTAP:** políticas del bucket `exports` (la propietaria lee lo suyo; una empleada y un anónimo no).
- **e2e:** la propietaria ve el resumen; descarga el Excel y se comprueban sus filas y totales; descarga el ZIP y se comprueba que tiene un PDF por factura y el Excel; una empleada no puede entrar.

## 8. Fuera

- Envío por email a la gestoría.
- Usuario de la gestoría.
- Modelos 130 y 303 (los hace la gestoría).
- Envío a la AEAT (Verifactu sigue preparado, sin envío).
- Exportación de cobros sin factura.
