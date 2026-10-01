# Auditoría funcional E2E de LUMIA (local), 01/10/2026

Entorno: rama `main` (6bb9a0f), Supabase local más las tres apps en modo dev (`pnpm turbo run dev`), Playwright headless (1366×900 y 390×844, es-ES, Europe/Madrid), Mailpit. Scripts en `scratchpad/audit/live/*.mjs` y capturas en `scratchpad/audit/live/shots/` (en este informe, `shots/` = `/private/tmp/claude-501/-Users-vicent-code-clinicalumia/ecc6be61-7f36-4174-acf7-4d354467ffb7/scratchpad/audit/live/shots/`).

Datos: partí del seed. Para simular una clínica recién instalada puse la serie principal de 2026 en «sin configurar» y la volví a configurar desde el admin. Creé la especialidad «Terapia ocupacional», un servicio, la empleada invitada «Irene Auditoría», un cierre el 12/10, los pacientes web Marta (adulta) y Sergio con Leo (tutor y menor), el walk-in Andrés y 9 facturas (de 1024/26 a 1031/26 y R168/26). **Al terminar lo borré todo** y dejé las series en 1024 y R168 (bloqueadas y configuradas), el pie de factura vacío, el storage vacío, el buzón de Mailpit limpio y los contadores iguales a la línea base (people 5, appointments 6, payments 0, invoices 0, users 3). Hay una copia de seguridad previa en `scratchpad/audit/live/backup-before.sql`.

Rendimiento: todas las páginas cargaron en menos de 1 s en local (agenda unos 700 ms, reserva web unos 800 ms, el ZIP del trimestre en 1 s). No hubo errores 5xx ni errores de consola durante los flujos. A 390 px no encontré scroll horizontal en ninguna pantalla revisada de web, panel y admin.

Cuadre del trimestre: Facturación del T4 da un neto de 250,00 € (160 € exento + 90 € con IVA al 21 %), igual que el total de Cobros del día (250,00 € sin contar el anulado). El Excel y el ZIP (9 PDF y el xlsx) se descargan bien.

## Resumen: las 10 más importantes

1. **Alta**: si la clínica cancela o mueve una cita, el paciente no recibe ningún email, aunque la reservara él por la web.
2. **Alta**: los servicios con señal («Valoración inicial», «Psicoterapia individual», «Sesión individual de fisioterapia») no se pueden reservar en la web porque los cobros online están desactivados. El admin no lo deja claro en el listado y la home anima a «Solicita tu primera valoración».
3. **Alta**: la detección de duplicados solo compara teléfono, DNI y email. Con el mismo nombre y la misma fecha de nacimiento se crea otra ficha sin aviso, que es el caso habitual de los menores.
4. **Alta**: sin numeración configurada no se puede registrar ni un cobro en efectivo, y el mensaje le dice a la propia propietaria «Pide a la propietaria…». El admin no avisa de nada.
5. **Media**: corregir una factura completa obliga a anular el cobro, cobrar otra vez y emitir otra completa, sin que se recuerden los datos de la empresa. Una sola cita acaba con 5 facturas.
6. **Media**: en el Excel de la gestoría, la factura 1029/26 aparece como «Emitida» aunque está rectificada por R168/26. En el panel sí aparece «Rectificada por R168/26».
7. **Media**: una cita marcada como no presentada sigue en «Pendientes de cobro» y en «Registrar cobro → Hoy» con el precio completo y sin ninguna marca.
8. **Media**: cuando el paciente cambia la hora, el email llega con el asunto «Cita confirmada» y sin la hora anterior. El email de cancelación no incluye un ICS de cancelación, así que el evento sigue en el calendario del paciente.
9. **Media**: la web pública no tiene ningún enlace a «Mi cuenta». El paciente solo llega desde los emails.
10. **Media**: las citas que da la clínica a un paciente con email (por teléfono o en recepción) no le envían confirmación.

Recuento: **Bloqueante 0 · Alta 4 · Media 13 · Baja 14**.

---

## Hallazgos

### A1. La cancelación o el cambio hechos por la clínica no se notifican al paciente
- **Severidad:** Alta
- **Paso:** 3, día del personal (cancelar y mover)
- **Qué pasó:** cancelé desde el panel, como «La clínica», con el motivo «Enfermedad de la profesional», la cita de Leo del 05/10 que se había reservado por la web («Reserva web»). Al tutor no le llegó ningún email (Mailpit vacío tras 5 s). En Mi cuenta solo aparece «Cancelada por la clínica» en el historial. Mover la cita de Marta del 02/10 de 10:00 a 11:30 tampoco generó ningún email, aunque Marta tiene email y cuenta.
- **Qué se esperaba:** un email de «Cita cancelada» con el motivo o un aviso de llamar, y un email de «Cita cambiada» con la hora anterior y la nueva, con su ICS actualizado.
- **Cómo reproducirlo:** reservar desde /reservar; en el panel del dashboard, abrir la cita, pulsar Cancelar cita, elegir «La clínica» y confirmar. Revisar Mailpit.
- **Capturas:** `shots/17m-cancel-dialog.png`, `shots/17m-tutor-after-clinic-cancel.png`, `shots/12-moved.png`
- **Propuesta:** reutilizar las plantillas de cancelación y cambio del área de paciente en las acciones del panel, al menos cuando la persona (o su tutor principal) tiene email. Si se quiere control, añadir una casilla «Avisar al paciente por email», marcada por defecto.

### A2. Los servicios con señal desaparecen de la reserva web sin que el admin lo deje claro
- **Severidad:** Alta
- **Paso:** 1, configuración (servicios) y 2, reserva del paciente
- **Qué pasó:** en /reservar → Logopedia, «Valoración inicial» aparece como «Reserva por teléfono: 614 552 808». Lo mismo ocurre con «Psicoterapia individual» y «Sesión individual de fisioterapia». La home invita a «Solicita tu primera valoración», que es justo el servicio que no se puede reservar online. En el listado de servicios del admin, la columna «Reserva web» dice «Señal 10,00 €», que da a entender que sí se reserva online. El aviso «No se podrá reservar online hasta activar los cobros» solo aparece dentro del formulario de edición, al elegir la señal.
- **Qué se esperaba:** que el listado diga «Solo por teléfono (cobros online desactivados)» o que se pueda reservar con el pago en la clínica hasta que se activen los cobros online.
- **Cómo reproducirlo:** con el seed, abrir /reservar → Logopedia, y comparar con Admin → Servicios.
- **Capturas:** `shots/04m-1-services.png`, `shots/19m-admin_services.png`, `shots/02-service-deposit-option.png`
- **Propuesta:** en el listado, mostrar «Por teléfono» cuando `booking_payment ≠ none` y `online_payments_enabled = false`, y poner un aviso en el inicio del admin. Hay que decidir si el seed refleja la configuración real de producción. Si es así, la valoración inicial no se puede reservar online en prod.

### A3. La detección de duplicados no compara nombre y fecha de nacimiento
- **Severidad:** Alta
- **Paso:** 3, paciente nuevo en recepción
- **Qué pasó:** al crear «Elena Gómez Díaz», nacida el 22/03/1990, exactamente igual que la del seed, no salió ningún aviso. Tampoco con «Elena Gomez Diaz», sin tildes. Creé la ficha duplicada sin problema. `find_possible_duplicates` solo compara `tax_id`, `email` y `phone`. Los menores casi nunca tienen ninguno de los tres, así que en ellos el duplicado es casi seguro. Por teléfono sí funciona bien: «Puede que ya tenga ficha · mismo teléfono», con los botones «Usar esta ficha» y «No es ninguna de estas».
- **Qué se esperaba:** que avise de «mismo nombre y fecha de nacimiento», ignorando tildes y mayúsculas.
- **Cómo reproducirlo:** Pacientes → Nuevo paciente → Elena / Gómez Díaz / 22/03/1990, sin teléfono.
- **Capturas:** `shots/08c-dup-exact-name.png`, `shots/08b-dup-name.png`, `shots/08-3-duplicate.png` (el caso que sí funciona)
- **Propuesta:** añadir a la función una coincidencia por `unaccent(lower(first_name||last_name))` más `birth_date`. Como mínimo, comparar apellidos y fecha.

### A4. Sin numeración configurada no se puede cobrar, y el mensaje no sirve a la propietaria
- **Severidad:** Alta
- **Paso:** 1 y 3, primer cobro en una clínica nueva
- **Qué pasó:** con la serie principal «sin confirmar», al pulsar Cobrar → Efectivo → Registrar cobro sale el error «Falta configurar la numeración de facturas. Pide a la propietaria que la complete en el admin (Datos de la clínica → Facturación).». No se guarda nada: no se puede ni apuntar el dinero recibido. Quien lo vio era la propia propietaria. El inicio del admin no avisa de nada, y en Datos de la clínica el estado solo dice «sin confirmar».
- **Qué se esperaba:** un aviso destacado en el inicio del admin («Antes de cobrar, confirma la numeración de facturas»). En el dashboard, si quien cobra es la propietaria, un enlace directo al admin. Como alternativa, permitir registrar el cobro y emitir la factura después.
- **Cómo reproducirlo:** dejar `invoice_series.configured = false` para el año en curso y cobrar cualquier cita.
- **Capturas:** `shots/09-2-after-submit.png`, `shots/02-clinic-series-unconfigured.png`, `shots/01-admin_.png`
- **Propuesta:** poner en el inicio del admin una lista «Pendiente de configurar» (numeración, datos fiscales, horarios) y adaptar el mensaje según el rol.

### M1. Corregir una factura completa genera una cadena de 5 facturas y no recuerda los datos
- **Severidad:** Media
- **Paso:** 3, factura completa para empresa y rectificativa
- **Qué pasó:** con un cobro en efectivo de 90 € se emitió la simplificada 1028/26. Al pedir «Factura completa» para Talleres Auditoría S.L. se emitió 1029/26. Para corregirla, el detalle solo ofrece «Emitir rectificativa y anular cobro» (R168/26) y el cobro queda anulado. Al cobrar otra vez se emitió otra simplificada (1030/26) y luego otra completa (1031/26). El formulario de la completa volvió a salir con el nombre de la paciente y sin el NIF ni la dirección de la empresa. En la ficha de Marta quedan 6 facturas y en Cobros, dos cobros de 90 € (uno anulado) por la misma cita. El total del trimestre cuadra, pero una recepcionista no entiende la cadena.
- **Qué se esperaba:** un flujo «Corregir datos del destinatario» que emita la rectificativa y la nueva completa en un solo paso, sin anular el cobro, o como mínimo que se rellenen solos los datos de la última completa.
- **Cómo reproducirlo:** cobrar el «Informe psicológico no sanitario», pedir Factura completa, ir a Facturas → detalle → Emitir rectificativa, cobrar de nuevo y pedir otra vez Factura completa.
- **Capturas:** `shots/13-rectify-dialog.png`, `shots/13b-rectified.png`, `shots/13b-recollected-full.png`, `shots/14-marta-ficha.png`, `shots/13b-cobros.png`
- **Propuesta:** una acción «Rectificar y reemitir» desde el detalle de la completa. Rellenar el destinatario con la última factura completa del paciente.

### M2. En el Excel, una factura rectificada aparece como «Emitida»
- **Severidad:** Media
- **Paso:** 4, cierre de trimestre
- **Qué pasó:** en `LUMIA-facturas-2026-T4.xlsx`, la fila de 1029/26 tiene Estado «Emitida» y «Suma en totales: No». En el dashboard la misma factura aparece como «Rectificada por R168/26». La gestoría no ve en la propia fila que esa factura está rectificada.
- **Qué se esperaba:** Estado «Rectificada por R168/26», igual que en la lista.
- **Cómo reproducirlo:** rectificar una factura completa y descargar el Excel del trimestre.
- **Capturas:** `shots/18-facturacion-t4.png` (fichero: `scratchpad/audit/live/dl-LUMIA-facturas-2026-T4.xlsx`)
- **Propuesta:** usar en el Excel el mismo cálculo de estado (incluidas las rectificadas) que usa la lista de Facturas.

### M3. Las citas no presentadas siguen como pendientes de cobro
- **Severidad:** Media
- **Paso:** 3, no presentada y Pendientes de cobro
- **Qué pasó:** después de marcar la cita de Andrés de las 18:00 como «No presentada», el panel sigue mostrando «Pendiente de cobro / Cobrar». Aparece en Cobros → Pendientes («01/10 18:00 Andrés… 30,00 € Cobrar») y en «Registrar cobro → HOY» con 30,00 €, sin indicar que no vino. Una recepcionista intentará cobrar al paciente o pensará que hay un descuadre.
- **Qué se esperaba:** sacar de Pendientes las citas no presentadas o mostrarlas aparte con la etiqueta «No presentada», y con un importe opcional de penalización si se quiere cobrar.
- **Cómo reproducirlo:** en el panel de una cita pasada, pulsar Marcar como no presentada y confirmar, y luego abrir Cobros → Pendientes.
- **Capturas:** `shots/12-noshow.png`, `shots/13b-pendientes.png`, `shots/19-register-dialog.png`

### M4. Los emails de cambio y cancelación no actualizan bien el calendario del paciente
- **Severidad:** Media
- **Paso:** 2, Mi cuenta (cambiar y cancelar)
- **Qué pasó:** cuando el paciente cambia la hora en Mi cuenta, recibe un email con el asunto «Cita confirmada», igual que en una reserva nueva, sin «antes/ahora». Parece una segunda cita. El ICS reutiliza el UID pero no lleva `SEQUENCE` ni `METHOD:REQUEST`, así que Google y Apple pueden no actualizar el evento. El email de «Cita cancelada» no lleva adjunto, y el evento que se añadió con el primer ICS se queda en el calendario.
- **Qué se esperaba:** el asunto «Cita cambiada: ahora lunes 5 a las 16:15 (antes 15:15)», un ICS con `SEQUENCE` mayor y, en la cancelación, un ICS con `METHOD:CANCEL` y `STATUS:CANCELLED`.
- **Cómo reproducirlo:** en /mi-cuenta, pulsar Cambiar, elegir otra hora y confirmar. Después, Cancelar. Revisar Mailpit.
- **Capturas:** `shots/05bm-3-after-reschedule.png`, `shots/05c-2-after-cancel.png`

### M5. La web pública no enlaza a «Mi cuenta»
- **Severidad:** Media
- **Paso:** 2, área del paciente
- **Qué pasó:** ni la cabecera, ni el menú móvil, ni el pie tienen un enlace a Mi cuenta o Acceder (encontré 0 enlaces). Un paciente que quiere cambiar su cita y no encuentra el email no tiene cómo entrar, salvo escribir /mi-cuenta a mano.
- **Cómo reproducirlo:** abrir / en móvil y en escritorio.
- **Capturas:** `shots/04m-0-home.png`, `shots/04m-0-menu.png`
- **Propuesta:** añadir «Mi cuenta» junto a «Coger cita» y en el pie.

### M6. Las citas creadas por la clínica no envían confirmación al paciente
- **Severidad:** Media
- **Paso:** 3, nueva cita
- **Qué pasó:** di una cita a Marta (que tiene email y cuenta) para el 02/10 a las 10:00 desde Nueva cita y no recibió ningún email. La cita aparece en su Mi cuenta, pero el paciente no se entera.
- **Propuesta:** una casilla «Enviar confirmación por email» en Nueva cita, marcada por defecto cuando la persona o su tutor tiene email.
- **Captura:** `shots/08b-2-after-submit.png`

### M7. El paciente no recibe copia del consentimiento firmado
- **Severidad:** Media
- **Paso:** 2, /consentimiento
- **Qué pasó:** tanto con la firma dibujada (móvil) como con la escrita (escritorio) aparece «¡Gracias! Hemos recibido tu consentimiento firmado.». Solo le llega un email a info@clinicalumia.es. Al email que puso el paciente no le llega nada.
- **Qué se esperaba:** una copia en PDF para el firmante, como buena práctica del RGPD y para que la tenga como justificante.
- **Capturas:** `shots/06b-drawm-result.png`, `shots/06b-type-result.png`

### M8. Al asociar un consentimiento, sus datos no pasan a la ficha
- **Severidad:** Media
- **Paso:** 3, asociar consentimiento
- **Qué pasó:** el consentimiento de Marta incluye el DNI 12345678Z, pero después de asociarlo la ficha sigue con «DNI/NIE: —». Más tarde, la factura completa pide el NIF a mano. En el formulario, «DNI / NIE» no aclara si es el del menor o el del tutor: en el caso de Leo escribí el del tutor y quedó guardado como DNI del menor.
- **Propuesta:** al asociar, ofrecer «Completar la ficha con DNI, email y fecha de nacimiento» si la ficha no los tiene. En el formulario, separar «DNI del paciente» y «DNI del tutor».
- **Capturas:** `shots/14-linked.png`, `shots/14-marta-ficha.png`, `shots/06-consent-page.png`

### M9. El detalle de la factura completa muestra al paciente en lugar del destinatario
- **Severidad:** Media
- **Paso:** 3, factura completa
- **Qué pasó:** en Facturas → 1029/26, el detalle muestra «Completa · 01/10/2026 · Marta Auditoría Pons · 90,00 €». La lista y el PDF dicen «Talleres Auditoría S.L.». Además, el título se repite tres veces («1029/26 / Factura 1029/26 / Factura 1029/26»).
- **Propuesta:** mostrar «Para: Talleres Auditoría S.L. (NIF B12345674) · Paciente: Marta…».
- **Capturas:** `shots/13-detail-full.png`, `shots/13-list.png`

### M10. Una empleada invitada que aún no ha aceptado ya se puede reservar en la web
- **Severidad:** Media
- **Paso:** 1 y 2
- **Qué pasó:** en cuanto Irene tuvo horario (sin haber creado todavía su contraseña), apareció en /reservar → «¿Con quién?», con huecos, y recibió una reserva.
- **Propuesta:** no ofrecerla en la web hasta que active la cuenta, o que el admin avise («Irene aún no ha aceptado la invitación; ya recibe reservas»).
- **Captura:** `shots/03-3-professionals.png`

### M11. Equipo: no hay estado de la invitación y «Reenviar invitación» sigue tras aceptarla
- **Severidad:** Media
- **Paso:** 1, equipo
- **Qué pasó:** después de que Irene creara su contraseña y activara el 2FA, su fila sigue mostrando «Reenviar invitación», como la de todas las demás empleadas. No hay nada que diga «Invitación pendiente» o «Activa». Junto a ella aparece «Invalidar calendario», que es jerga.
- **Capturas:** `shots/02-team-invited.png`, `shots/19m-admin_team.png`
- **Propuesta:** una insignia «Pendiente de aceptar» y mostrar «Reenviar» solo en ese caso. Renombrar «Invalidar calendario» a «Cortar acceso al calendario del móvil».

### M12. La agenda no distingue las citas cobradas de las pendientes
- **Severidad:** Media
- **Paso:** 3, agenda
- **Qué pasó:** en la vista de día, la cita de Andrés de las 19:00 (cobrada) y la de las 18:00 (no presentada, sin cobrar) se ven igual. Al cerrar el día, la recepcionista tiene que abrir cita por cita o ir a Cobros.
- **Capturas:** `shots/11-andres1900-cash.png`, `shots/11-agenda-day.png`
- **Propuesta:** un icono o borde para cobrada, pendiente y no presentada.

### M13. Una empleada puede editar, archivar y quitar tutores en cualquier ficha (hay que confirmar si es intencionado)
- **Severidad:** Media
- **Paso:** 3, privacidad de la empleada
- **Qué pasó:** la privacidad de las citas funciona. Laura solo ve sus citas; las de otras profesionales salen como bloques ocupados; las facturas de otras devuelven 404, también el PDF; Cobros y Facturas solo muestran lo suyo; y su calendario del móvil solo tiene sus citas. Pero Laura ve todas las fichas de pacientes y todos los consentimientos. En la ficha de Leo (paciente de Patricia) tiene «Editar», «Archivar» y «Quitar» tutor, aunque no ve sus citas ni sus cobros.
- **Capturas:** `shots/15-leo-ficha-as-laura.png`, `shots/07-laura_patients.png`, `shots/07-laura_consentimientos.png`
- **Propuesta:** si la ficha es compartida a propósito, documentarlo. Si no, limitar Archivar y Quitar tutor a la propietaria.

### B1. El error del NIF en Datos de la clínica sale lejos del campo
- **Severidad:** Baja
- **Paso:** 1, Datos de la clínica
- **Qué pasó:** con «12345», el mensaje «El NIF/CIF no es válido…» aparece junto a «Guardar datos», al final del formulario, y el campo no se marca. Con el código postal «4680» (4 cifras) no hubo ningún aviso específico.
- **Captura:** `shots/02-clinic-invalid-nif.png`

### B2. El formato de la numeración es jerga técnica
- **Severidad:** Baja
- **Paso:** 1
- **Qué pasó:** «Formato {n}/{aa}» y el estado «sin confirmar» no se entienden sin explicación (con «F-{n}» la vista previa dice «Falta el año ({aa} o {año})»). Además, el inicio del admin no tiene tarjeta de «Facturación», aunque sí está en el menú.
- **Capturas:** `shots/02-clinic-series-unconfigured.png`, `shots/01-admin_.png`
- **Propuesta:** un selector de formatos con ejemplos y que el estado diga «Pendiente: pulsa Guardar para empezar a facturar».

### B3. Página de reserva confirmada: texto en futuro y faltan acciones
- **Severidad:** Baja
- **Paso:** 2
- **Qué pasó:** «Te enviaremos la confirmación» cuando ya se ha enviado. No hay botón «Añadir a mi calendario» ni dirección o teléfono. El email de confirmación tampoco incluye la dirección, el teléfono ni el plazo de cancelación (24 h).
- **Capturas:** `shots/03c-3-confirmed.png`, `shots/04bm-3-confirmed.png`

### B4. El resumen de reserva con «El primer hueco libre» no dice quién atenderá
- **Severidad:** Baja
- **Paso:** 2
- **Qué pasó:** el resumen dice «Profesional: El primer hueco libre» y solo al confirmar aparece «Patricia Hernán».
- **Captura:** `shots/04bm-2-summary.png`

### B5. La numeración de los pasos se salta el 5 y el título «Tus datos» se repite
- **Severidad:** Baja
- **Paso:** 2
- **Qué pasó:** se pasa de «Paso 4 de 7» a «Paso 6 de 7» después del acceso. En el paso de datos se lee «Tus datos / ¿Para quién es? / Tus datos».
- **Captura:** `shots/03b-2-after-code.png`

### B6. Rectificar solo se puede desde Facturas, no desde el panel de la cita
- **Severidad:** Baja
- **Paso:** 3
- **Qué pasó:** el panel ofrece «Anular cobro», pero no «Rectificar». Una recepcionista no sabrá que tiene que ir a Facturas → detalle.
- **Captura:** `shots/12-full-done.png`

### B7. La nota de Facturación sobre completas y rectificativas confunde
- **Severidad:** Baja
- **Paso:** 4
- **Qué pasó:** «Una completa que sustituye a una simplificada aparece en el libro pero no suma». Con una rectificativa de una completa, el contable ve que R168 rectifica la 1029, que «no suma», y aun así R168 resta. El neto es correcto, pero la explicación no cubre ese caso.
- **Captura:** `shots/18-facturacion-t4.png`

### B8. El email usado para enviar una factura no se guarda en la ficha
- **Severidad:** Baja
- **Paso:** 3
- **Qué pasó:** envié la factura 1024/26 a andres.auditoria@test.local («Factura enviada a…», con el PDF adjunto correcto), pero la ficha de Andrés siguió sin email. El campo vuelve a salir vacío la próxima vez.
- **Captura:** `shots/13-sent.png`

### B9. Las citas canceladas aparecen en «Próximas» de la ficha
- **Severidad:** Baja
- **Paso:** 3
- **Qué pasó:** la ficha de Marta lista en PRÓXIMAS «05/10 10:00 · Cancelada por el paciente».
- **Captura:** `shots/14-marta-ficha.png`

### B10. Una cita cancelada desaparece de la agenda sin dejar rastro
- **Severidad:** Baja
- **Paso:** 3
- **Qué pasó:** al cancelar la cita de Marc de las 19:00, el bloque desaparece del todo. No queda ninguna marca de «hueco liberado» ni hay opción de ver las canceladas del día.
- **Captura:** `shots/12-cancelled.png`

### B11. Enlace a la cita de otra profesional: el panel no se abre y no hay mensaje
- **Severidad:** Baja
- **Paso:** 3, privacidad
- **Qué pasó:** Laura abre `/?appointment=<cita de Patricia>` y solo ve su agenda, sin ningún «No tienes acceso a esta cita».
- **Captura:** `shots/15-leo-appt-as-laura.png`

### B12. Los mensajes de validación son los nativos del navegador
- **Severidad:** Baja
- **Paso:** 1 y 2
- **Qué pasó:** los campos vacíos y las fechas futuras usan la validación nativa («Value must be 01/10/2026 or earlier», en el idioma del navegador). El selector de logo es el nativo («Choose File»). En un Chrome en español saldrá traducido, pero el estilo no encaja con el resto de errores.
- **Capturas:** `shots/04bm-1-future-birthdate.png`, `shots/01-admin_clinic.png`

### B13. Al cambiar una cita del panel fuera de horario, el aviso es poco visible
- **Severidad:** Baja
- **Paso:** 3, mover cita
- **Qué pasó:** al mover a las 13:30 (termina a las 14:20, después de las 14:00 del horario de Irene) sale «Queda fuera del horario de Irene Auditoría. Guardar igualmente». Funciona, pero no se ve con claridad que el cambio no se ha guardado todavía.
- **Captura:** `shots/12-move-outside.png`

### B14. El URL de reserva arrastra `fecha` de hoy aunque se haya elegido otro día
- **Severidad:** Baja
- **Paso:** 2
- **Qué pasó:** `…&fecha=2026-10-01&inicio=2026-10-05T08:00…`. No afecta a nada visible, pero si se comparte el enlace se abre en la semana equivocada.

---

## Lo que funcionó bien (sin incidencias)
- **Admin:** la especialidad duplicada se rechaza con «Ya existe una especialidad con ese nombre.»; los tramos de horario con la hora de fin anterior a la de inicio se rechazan con un mensaje claro; «Datos guardados.», «Numeración guardada.», «Horario guardado.» e «Invitación enviada por email.» se confirman bien.
- **Cierres:** el 12/10 no ofrece huecos en la web.
- **Reserva web:** el código de acceso por email funciona y se respeta la antelación mínima de 24 h. El menor con tutor se crea bien («Menor», «Padre · Principal»).
- **Mi cuenta:** el ICS de la cita es correcto (zona horaria y ubicación), y fuera de plazo aparece «Fuera de plazo: llama al 614 552 808».
- **Consentimiento:** sin firma sale «Falta la firma.» La asociación por email fue automática para Marta y manual para Leo, con «Asociar a esta ficha».
- **Cobros:** las cuatro formas de pago funcionan, con toasts claros. Cambiar el importe exige motivo. La anulación exige motivo.
- **Facturas:** la factura completa valida el NIF/CIF. Los totales del trimestre coinciden con Cobros. Excel y ZIP salen bien.
- **Privacidad:** las facturas, cobros y calendario de una empleada quedan aislados.
- **Alta de empleada:** invitación → contraseña de 12 o más caracteres → 2FA con QR, todo bien en móvil.
- **Móvil (390 px):** web, panel y admin, sin scroll horizontal.
