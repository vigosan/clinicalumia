# Pieza 3b — Reserva web y área de paciente · Diseño

Fecha: 2026-09-28 · Estado: pendiente de revisión

Parte de la plataforma LUMIA v1 (`specs/2026-09-25-plataforma-lumia-v1-design.md`, secciones 2 y 3, pieza 3). Depende de:

- **Pieza 1:** servicios, horarios, ausencias, datos de la clínica y emails por Resend.
- **Pieza 2:** personas y tutela.
- **Pieza 3a:** citas, reglas y agenda.

La 3c (recordatorios y calendario ICS) va aparte.

## 1. Objetivo

Que un paciente, o su madre o padre, reserve una cita desde la web en un par de minutos. Y que después, desde su cuenta, vea, cambie o cancele sus citas y las de sus menores, sin llamar a la clínica, dentro de las reglas de la clínica.

**Éxito:**
- una cita reservada en la web aparece al instante en la agenda del profesional, marcada como "Reserva web";
- nadie puede reservar a nombre de un email que no controla;
- un paciente nunca ve datos del equipo ni de otros pacientes;
- fuera del plazo de cancelación gratuita, la web no deja cambiar ni cancelar y remite a la clínica;
- cuando llegue el TPV (pieza 4), el cobro al reservar se activa sin rehacer la reserva.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Cuenta | Cada paciente tiene cuenta, **sin contraseña**. Entra con **enlace mágico por email**. El mismo email lleva también un **código de 6 dígitos** para abrirlo en otro dispositivo o si el correo "abre" el enlace solo. La sesión dura semanas en ese dispositivo. |
| Titular de la cuenta | La cuenta es **del email**. Gestiona a todas las personas de la clínica con ese email (no archivadas) y a los menores de los que alguna de ellas es tutora. Al reservar se elige "para quién". |
| Alta | El registro abierto de Supabase sigue cerrado (el equipo entra por invitación). La cuenta de paciente la crea el servidor al pedir el acceso. Hay un límite de peticiones por email y por red. |
| Personas nuevas | Si el email no tiene fichas, o se reserva para alguien nuevo, se pide nombre, apellidos, fecha de nacimiento y teléfono, y aceptar la política de privacidad (se guarda cuándo y la versión). Un menor nuevo queda con quien reserva como tutor. Si quien reserva no tiene ficha, se crea con `is_patient = false`. Si el adulto nuevo es el propio paciente, con `is_patient = true`. |
| Pago | Configurable por servicio (pieza 1). Mientras no haya TPV, un servicio con pago configurado **no se reserva online** y muestra "Reserva por teléfono". Cada cita web guarda lo que habría que pagar y un estado de pago (`not_required` por ahora). |
| Límites | Configurables en "Datos de la clínica": **antelación mínima 24 h**, **horizonte 60 días**. Huecos **cada 15 minutos**, dentro del horario, sin ausencias ni solapes y con la duración del servicio. |
| Profesional | El paciente elige profesional o **"El primer hueco libre"** entre los activos de la especialidad. |
| Cambiar y cancelar | Desde el área de paciente, **solo dentro del plazo de cancelación gratuita** (el del servicio o el general). Fuera de plazo: "Llama a la clínica". Cancelar desde la web queda como "cancelada por el paciente". |
| Confirmación | Email "Cita confirmada" al reservar y al cambiar; "Cita cancelada" al cancelar. Por Resend en producción y Mailpit en local. |
| Barrera | Toda la lógica del paciente vive en **funciones de base de datos** (`security definer`) que comprueban que la persona pertenece a la cuenta. Los pacientes no tienen políticas RLS de escritura directa. |
| Datos reales | Hasta revisar la región de Supabase y el RGPD (spec v1, sección 5), solo datos inventados en local y dev. |

## 3. Esquema y funciones

### Cambios en tablas existentes

- **`appointments`:**
  - `origin` (enum `staff`, `web`, por defecto `staff`);
  - `booked_by_account` (uuid → `auth.users`, nulo en citas del equipo);
  - `payment_required` (enum `none`, `fixed`, `percent`, `full`) y `payment_amount_cents` (integer), copiados del servicio al crear;
  - `payment_status` (enum `not_required`, `pending`, `paid`, `refunded`, por defecto `not_required`).
- **`appointment_events`:** `actor_kind` (enum `staff`, `patient`). En los eventos de pacientes, `actor_id` es nulo; la cuenta queda en la cita (`booked_by_account`).
- **Triggers de citas:**
  - las reservas y cambios de pacientes solo llegan desde las funciones de paciente;
  - el trigger lo reconoce por una marca local de la transacción (`lumia.booking_account` = `auth.uid()`) que solo esas funciones pueden poner, y en ese caso no aplica la comprobación "personal activo";
  - todo lo demás (solapes, estados, medianoche, especialidad) se aplica igual.
- **`clinic_settings`:** `booking_min_notice_hours` (0–168, por defecto 24) y `booking_horizon_days` (1–365, por defecto 60).

### Tablas nuevas

- **`patient_accounts`:**
  - campos: `id` (= `auth.users.id`), `email` (minúsculas, único), `created_at`, `privacy_accepted_at`, `privacy_version`;
  - la crea y consulta solo el servidor o las funciones.
- **`access_requests`:**
  - registro de peticiones de acceso: `email`, `ip_hash`, `created_at`;
  - sirve para el límite de 5 peticiones por hora y email, y 20 por hora y red;
  - solo la lee el servidor.

### Funciones

Todas en `public`, `security definer`, `search_path = ''`.

**Solo para la sesión de un paciente.** Requieren `auth.uid()` presente en `patient_accounts`.

- **`my_people()`:** personas de la cuenta y sus menores (id, nombre, fecha de nacimiento, si es menor, si es tutora).
- **`my_appointments()`:** citas de esas personas, con servicio, profesional (solo nombre), estado, si se puede cambiar o cancelar y hasta cuándo.
- **`book_appointment(p_person_id, p_service_id, p_professional_id, p_starts_at)`:**
  - valida la persona (de la cuenta), el servicio (activo, reservable online, sin pago mientras no haya TPV), el profesional (activo, de la especialidad, o `null` = el primero libre), la antelación, el horizonte, que cabe entera en un tramo del horario, que no hay ausencia y que no se solapa;
  - crea la cita con `origin = 'web'` y devuelve su id.
- **`reschedule_my_appointment(p_appointment_id, p_starts_at)`:** mismas validaciones y dentro del plazo gratuito.
- **`cancel_my_appointment(p_appointment_id)`:** dentro del plazo gratuito.
- **`add_my_person(...)`:** crea un adulto con el email de la cuenta o un menor tutelado por una persona de la cuenta.
- **`update_my_contact(p_person_id, p_phone, p_address)`.**

**Públicas** (también para `anon`; sin datos personales):

- **`booking_catalog()`:** especialidades y servicios reservables (nombre, duración, precio, si se reserva online o "por teléfono") y profesionales activos por especialidad (solo nombre).
- **`available_slots(p_service_id, p_professional_id, p_from date, p_to date)`:**
  - huecos libres (inicio y profesional) según horarios, ausencias, citas no canceladas, antelación y horizonte;
  - máximo 14 días por llamada.

## 4. Reglas puras (con tests)

- **Validación de los formularios web:** email, datos de persona nueva (reutiliza `parsePersonForm` de la pieza 2 y la validación de DNI/NIE opcional) y aceptación de privacidad.
- **Texto del plazo:** "Puedes cambiarla o cancelarla hasta el martes 14 a las 18:00" y "Fuera de plazo: llama al 614 552 808".
- **Agrupación de huecos por día y franja** (mañana y tarde) para la pantalla.

## 5. Pantallas de la web (`apps/web`)

Van con el estilo de la web (tipografía y colores de marca) y los componentes de `@clinicalumia/ui`. Están pensadas primero para el móvil.

**`/reservar`:**
1. Especialidad.
2. Servicio: duración y precio; "Reserva por teléfono" si no se reserva online.
3. Profesional o "El primer hueco libre".
4. Día y hora: calendario de los próximos días con huecos; "No hay huecos estos días" con enlace al teléfono.
5. "¿Quién eres?": email → "Te hemos enviado un enlace y un código" → pulsar el enlace o escribir el código.
6. "¿Para quién es la cita?": sus personas y menores, o "Otra persona".
   - **Si es su primera vez,** rellena sus datos y acepta la privacidad.
   - **Si es otra persona,** elige "Soy su madre/padre/tutor" o "Es para mí".
7. Resumen → "Confirmar cita" → pantalla y email de confirmación.

**El recorrido no se pierde:** mientras se identifica, se guarda la elección (servicio, profesional y hora). Si el hueco se ocupa entre medias, se avisa y se vuelve al paso 4.

**`/mi-cuenta`** (con sesión):
- **Próximas citas** de todas sus personas: fecha, hora, para quién, servicio, profesional y "Cambiar" / "Cancelar" si está en plazo.
- **Historial.**
- **Personas:** sus personas y menores, y "Añadir un menor".
- **Datos de contacto:** teléfono y dirección.
- **"Salir".**

**Acceso:** `/acceder` (email) y `/acceder/codigo`. El enlace mágico vuelve a la página de origen (`next` validado, rutas internas).

**Cabecera de la web:** "Reservar cita" y "Mi cuenta".

## 6. Cambios en dashboard y admin

- **Agenda y panel de la cita:** etiqueta "Reserva web". El historial muestra "Reservada desde la web por lucia@…" ("Reservada desde la web por el paciente" si no hay email).
- **Admin, "Datos de la clínica":** antelación mínima y horizonte.
- **Admin, servicios:** "Se reserva online" se mantiene. Si un servicio online tiene pago configurado, sale el aviso "No se podrá reservar online hasta activar los cobros".

## 7. Seguridad

- Un paciente no tiene perfil de equipo, así que `is_active_staff()` e `is_owner()` son falsos y no ve nada del equipo.
- Todas las funciones de paciente comprueban la pertenencia de la persona a la cuenta. Ninguna devuelve emails, teléfonos ni datos de otras personas.
- `available_slots` y `booking_catalog` no exponen pacientes, motivos de ausencia ni notas.
- Las cuentas de paciente no pueden entrar en el dashboard ni en el admin: su proxy exige perfil de equipo y segundo paso.
- El límite de peticiones de acceso evita que la web se use para enviar emails masivos.
- Las URLs del enlace mágico solo se permiten para el dominio de la web (`redirect_urls` de Supabase).

## 8. Pruebas

- **pgTAP:**
  - un paciente solo ve y toca sus personas y citas;
  - `book_appointment` rechaza, cada caso con su error:
    - una persona ajena;
    - un servicio no reservable o con pago;
    - un profesional de otra especialidad;
    - una reserva con menos antelación de la mínima o más allá del horizonte;
    - fuera de horario, en una ausencia o con solape;
  - cambiar o cancelar fuera de plazo se rechaza;
  - un paciente no llega a nada del equipo ni con RLS;
  - `available_slots` coincide con las reglas, incluidos los cambios de hora;
  - los triggers siguen aplicando todo a las citas web.
- **Vitest:** formularios, textos de plazo y agrupación de huecos.
- **e2e:**
  - reserva completa de un paciente nuevo con código (Mailpit);
  - reserva para un menor;
  - "Reserva por teléfono" en un servicio con pago;
  - cambiar y cancelar dentro de plazo;
  - rechazo fuera de plazo;
  - que otro email no ve esas citas;
  - que la cita aparece en la agenda del profesional con "Reserva web".

  Los tests son paralelos y con datos propios.

## 9. Entregas

- **3b-1 · Reserva y cuenta:** esquema, funciones públicas y de reserva, acceso, `/reservar` y los cambios en dashboard y admin.
- **3b-2 · Área de paciente:** `/mi-cuenta` con cambiar, cancelar, añadir menor y datos de contacto, y los emails de cambio y cancelación.

## 10. Fuera de esta pieza

- Cobro de la señal y devoluciones (pieza 4).
- Facturas y consentimientos en la cuenta (piezas 5 y 6).
- Recordatorios y calendario ICS (3c).
- Contraseñas.
- Lista de espera.
- Reservas de varias citas a la vez.
