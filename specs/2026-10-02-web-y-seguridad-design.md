# Web, permisos y seguridad · Diseño

Fecha: 2026-10-02 · Estado: aprobado («soluciona todo»)

Tercera de cuatro piezas que corrigen la auditoría del 01/10/2026 (`specs/auditoria/`). `R` = recorrido, `P` = paciente, `E` = equipo.

## 1. Objetivo

Que los formularios públicos no se puedan saturar, que el paciente se oriente solo en la web, que los permisos del equipo sean los decididos y que la propietaria pueda recuperar su acceso.

## 2. Decisiones

| Tema | Decisión | Hallazgos |
|------|----------|-----------|
| Límite de acceso | Además de los límites por email y por red, un límite global de envíos de código por hora por debajo del cupo de Supabase (80 de 100). Al superarlo: «Ahora mismo hay muchas peticiones. Inténtalo en unos minutos o llama al 614 552 808.». La cuenta de paciente se crea al verificar el código, no al pedirlo. | P-M7, P-B4 |
| Captcha | Preparado pero desactivado: se activa con las claves de Cloudflare Turnstile (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) en `/acceder` y `/consentimiento`. Sin claves, no se muestra. | P-M7, P-M8 |
| Consentimiento | Límite por red (15 por hora, para que recepción pueda firmar varios pacientes seguidos en la tableta o la wifi de la clínica; una hora de recepción muy activa gasta la mitad del global) y global (30 por hora). El paciente recibe copia del PDF firmado si deja email. DNI/NIE validado (aviso suave si parece pasaporte) y campos separados «DNI/NIE del paciente» y «DNI/NIE del tutor/a» cuando es menor. El formulario se envía por POST aunque no haya cargado JavaScript, el botón se bloquea al enviar y un fallo al generar la firma escrita se explica. El lienzo se adapta al girar el móvil. | P-M8, R-M7, R-M8, P-B5, P-B6, P-B7, P-B12 |
| Asociar consentimiento | Al asociarlo, si la ficha no tiene DNI, email o fecha de nacimiento, se ofrece completarlos con los del consentimiento (el DNI del tutor nunca pasa a la ficha del menor). | R-M8 |
| Web pública | Enlace «Mi cuenta» en cabecera, menú móvil y pie. El plazo para cambiar o cancelar se muestra antes de confirmar y en el email. Un enlace de acceso caducado conserva la reserva en curso. Textos de la reserva: sin saltos en la numeración de pasos, sin títulos repetidos, «Te hemos enviado la confirmación», quién atenderá con «El primer hueco libre» (tras confirmar), «Añadir a mi calendario», y dirección y teléfono en la confirmación. Mensaje propio cuando el hueco caduca por la antelación mínima. | R-M5, P-M5, P-M6, R-B3, R-B4, R-B5, P-B9 |
| Menores | Un menor no puede reservar para sí mismo: `book_appointment` exige que una persona menor de la cuenta tenga tutor/a en esa cuenta. | P-B11 |
| Permisos del equipo | Archivar, eliminar fichas y quitar tutores/as: solo la propietaria (RLS y pantalla). El motivo de una ausencia solo lo ve la propietaria; el equipo ve «Ausencia». La lista de citas al archivar solo la ve la propietaria. | R-M13, E-B13, fiabilidad M1 |
| Equipo | Insignia «Pendiente de aceptar» y «Reenviar invitación» solo en ese caso. «Invalidar calendario» pasa a «Cortar el acceso al calendario del móvil». Una persona invitada que aún no ha activado su cuenta no aparece en la reserva web. | R-M10, R-M11 |
| Recuperar el 2FA de la propietaria | `make db.owner.reset-mfa email=…` (service role, pide confirmación) borra sus factores para que vuelva a configurarlos, y queda documentado en `specs/operacion.md`. La pantalla del código dice a la propietaria «Si has perdido el móvil, contacta con el soporte técnico» en vez de «pide que te la restablezcan». | E-M5 |
| Datos de la clínica | El error de NIF/CIF aparece junto a su campo, el código postal se valida (5 cifras) y la numeración se elige con ejemplos («1/26», «2026-0001»…) además del formato libre. | R-B1, R-B2 |

## 3. Fuera

Activar el captcha sin claves; SMS; diseño general (pieza D).

## 4. Pruebas

pgTAP para límites, menores, permisos y motivo de ausencia; unitarias para validaciones y mensajes; e2e: límite global de acceso, consentimiento con copia al paciente y límite, asociación que completa la ficha, «Mi cuenta» en la web, plazo visible, enlace caducado que conserva la reserva, menor que no reserva solo, empleada que no puede archivar, invitación pendiente, recuperación del 2FA por script (prueba local).
