# Fiabilidad antes de abrir · Diseño

Fecha: 2026-10-01 · Estado: aprobado («soluciona todo»)

Primera de cuatro piezas que corrigen la auditoría del 01/10/2026 (`specs/auditoria/`). Referencias a hallazgos: `R` = recorrido en vivo (`2026-10-01-recorrido.md`), `P` = paciente (`2026-10-01-paciente.md`), `E` = equipo (`2026-10-01-equipo.md`).

## 1. Objetivo

Que nadie se quede sin saber qué ha pasado con una cita y que el día a día no dependa de la propietaria por casos normales.

**Éxito:**
- el paciente se entera por email de toda cita que le dan, mueven o cancelan, y su calendario se actualiza;
- ningún recordatorio se pierde por un fallo puntual o por mover la cita;
- una persona no puede tener dos citas solapadas;
- recepción ve las fichas posibles duplicadas (también archivadas) antes de crear otra;
- desactivar a una profesional, poner una ausencia o archivar una ficha nunca deja citas fantasma;
- la propietaria sabe qué falta configurar antes de cobrar;
- enviar una factura por email funciona desde cualquier pantalla.

## 2. Decisiones

| Tema | Decisión | Hallazgos |
|------|----------|-----------|
| Avisos de la clínica | Al dar, mover o cancelar una cita desde el panel se envía email al paciente (o a sus tutores con email) con las mismas plantillas del área de paciente. Casilla «Avisar al paciente por email», marcada por defecto y visible solo si hay destinatario. El email de cambio dice «Cita cambiada» con la hora anterior y la nueva. | R-A1, R-M6, P-M3 |
| Calendario | Los `.ics` llevan `SEQUENCE` (época de la última modificación) y `METHOD:REQUEST`; la cancelación adjunta un `.ics` con `METHOD:CANCEL` y `STATUS:CANCELLED` y el mismo UID. | R-M4, P-M3 |
| Recordatorios | Segunda ejecución diaria del cron que reintenta los fallidos del mismo día; una fila por destinatario; un recordatorio «enviado» solo cuenta si fue para la fecha actual de la cita; `maxDuration = 300`. | P-M1, P-M2, P-B13 |
| Citas solapadas | Restricción de exclusión por `patient_id` (citas no canceladas ni no presentadas). `book_appointment` es idempotente: si la misma persona ya tiene cita a esa hora, devuelve esa cita. Cambiar a la misma hora no hace nada ni envía email. | P-A1, P-B1 |
| «El primer hueco libre» | Si el primer profesional falla por concurrencia, prueba el siguiente libre. | P-B8 |
| Duplicados | `find_possible_duplicates` añade nombre y apellidos sin tildes ni mayúsculas + fecha de nacimiento, e incluye fichas archivadas marcadas «Archivada» con «Desarchivar». Si el DNI choca al guardar, el error enlaza a la ficha existente. | R-A3, E-M4 |
| Profesional desactivada | Antes de desactivar, el admin lista sus citas futuras y no deja continuar mientras haya citas: hay que moverlas a otra profesional o cancelarlas desde el panel. La agenda de la propietaria muestra una columna de profesional inactiva cuando tiene citas en el rango, y esas citas se pueden reasignar con «Cambiar fecha u hora» (elegir otra profesional). Los recordatorios no salen para citas de profesionales inactivas. | E-A1 |
| Avisos de citas afectadas | Ausencias (como ya hacen los cierres), archivar una ficha y «Cambiar fecha u hora» a un día cerrado avisan. Archivar una ficha con citas futuras exige cancelarlas antes. | E-M3, E-M7, E-M8 |
| Configuración pendiente | El inicio del admin muestra «Pendiente de configurar» (numeración principal y rectificativa, datos fiscales, servicios activos, horarios). Los errores de numeración distinguen serie y rol: a la propietaria le enlazan al admin; a una empleada le dicen que avise a la propietaria. | R-A4, E-B7, E-B9 |
| Servicios con señal | Mientras los cobros online estén desactivados, el listado de servicios dice «Solo por teléfono» para los que tienen señal, con un aviso arriba. | R-A2 |
| Envío de facturas | Las fuentes del PDF se incluyen en todas las rutas del panel que lo generan; los errores del envío se muestran en línea. | E-M6, E-B5 |

## 3. Fuera

Cobros de más de 400 €, citas prepagadas y rectificativas (pieza B); límites anti-abuso y textos de la web (pieza C); diseño (pieza D).

## 4. Pruebas

pgTAP para restricciones y funciones; unitarias para plantillas, ICS y mensajes; e2e para cada recorrido: aviso al paciente al mover/cancelar/dar cita (Mailpit), doble confirmación sin segunda cita, duplicado por nombre+fecha y archivada, desactivar con citas, ausencia con citas, archivo con citas, inicio del admin con pendientes, envío de factura desde su detalle.
