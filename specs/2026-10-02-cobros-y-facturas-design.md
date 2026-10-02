# Cobros y facturas sin atascos · Diseño

Fecha: 2026-10-02 · Estado: aprobado («soluciona todo»)

Segunda de cuatro piezas que corrigen la auditoría del 01/10/2026 (`specs/auditoria/`). `R` = recorrido, `P` = paciente, `E` = equipo.

## 1. Objetivo

Que cobrar, corregir una factura o cambiar una sesión ya pagada no obligue a llamar a la propietaria ni genere cadenas de facturas, y que Cobros, Facturación y el Excel cuenten lo mismo.

## 2. Decisiones

| Tema | Decisión | Hallazgos |
|------|----------|-----------|
| Más de 400 € | `collect_payment` acepta un destinatario opcional. Por encima del límite de la simplificada exige destinatario y emite directamente una factura completa. El formulario de cobro pide los datos del destinatario cuando el importe supera 400 €. | E-M1 |
| Sesión pagada por adelantado | Se puede cambiar de fecha u hora una cita cobrada y facturada: el cobro es un anticipo y la factura no cambia. El historial registra el cambio y la ficha muestra «Factura emitida el …». Cancelar una cita cobrada ofrece en el mismo diálogo «Emitir rectificativa y cancelar». **A validar con la gestoría.** | E-A2, E-B1 |
| Corregir una factura completa | «Corregir destinatario» en el detalle de una completa: emite la rectificativa y la nueva completa en un paso, sin anular el cobro. El formulario de factura completa se rellena con los datos de la última completa del paciente. «Rectificar» también desde el panel de la cita. | R-M1, R-B6 |
| Detalle de factura | Muestra «Para: {destinatario} (NIF) · Paciente: {nombre}» y el título una sola vez. | R-M9 |
| No presentadas | No salen en Pendientes de cobro ni en «Registrar cobro», y liberan la franja de la profesional (la restricción de solapes y los huecos ignoran `no_show`). «Deshacer no presentada» avisa si la franja ya está ocupada. Sin penalización. | R-M3, E-B2 |
| Cobros y anulaciones | Una anulación aparece en Cobros en su propia fecha como importe negativo («Anulado · −45,00 €»); el día original no cambia. Así Cobros y Facturación cuadran por periodo. | E-M2 |
| Excel | El estado incluye «Rectificada por {código}». La nota de Facturación explica también las rectificativas de completas. | R-M2, R-B7 |
| Agenda | Cada cita muestra su estado de cobro con un icono discreto: cobrada, pendiente, no presentada. | R-M12 |
| Email de la factura | Si la ficha no tiene email, el usado para enviar la factura se guarda en la ficha (con casilla «Guardar en la ficha», marcada por defecto). | R-B8 |
| Quién cobra | Se mantiene: la propietaria o la profesional de la cita. Abrirlo a todo el equipo obligaría a enseñar a cada empleada los pacientes de las demás, y la privacidad del panel se diseñó al revés. El mensaje pasa a decir «Solo la profesional de la cita o la propietaria pueden cobrarla». | E-B10 |
| Avisos menores | `clinic_fiscal_data_missing` ya se resolvió en la pieza A. «Nueva cita» en una hora pasada pide confirmación. El orden de Pendientes pasa a ser de la más antigua a la más reciente (spec 4a). | E-B3, E-B4 |

## 3. Fuera

Pago online, penalizaciones por no presentarse, cambios en Verifactu.

## 4. Pruebas

pgTAP para cada función que cambia (`collect_payment`, rectificativa + reemisión, restricción de solapes, pendientes, totales con anulaciones); unitarias para mensajes y cálculos; e2e para cada recorrido: cobro de 450 € con factura completa, mover una cita cobrada, cancelar cobrada con rectificativa, corregir destinatario, no presentada fuera de pendientes y franja libre, anulación en Cobros, Excel con «Rectificada por».
