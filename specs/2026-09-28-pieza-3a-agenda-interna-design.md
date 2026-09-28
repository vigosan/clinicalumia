# Pieza 3a — Agenda interna · Diseño

Fecha: 2026-09-28 · Estado: pendiente de revisión

Parte de la plataforma LUMIA v1 (`specs/2026-09-25-plataforma-lumia-v1-design.md`, sección 3, pieza 3).

La pieza 3 se divide en tres entregas:
- **3a:** agenda interna (este documento).
- **3b:** reserva web y área de paciente.
- **3c:** recordatorios y calendario ICS.

3a depende de la pieza 1 (horarios, ausencias, servicios, segundo paso) y de la pieza 2 (personas). El boceto de referencia es `specs/bocetos/dashboard-agenda.png`.

## 1. Objetivo

Que el equipo deje Google Calendar para las citas de la clínica: cada profesional da, mueve y cancela sus citas en el dashboard, ve los huecos ocupados de sus compañeros y la ficha del paciente muestra su historial de citas.

**Éxito:**
- dar una cita a un paciente en menos de un minuto, con aviso si cae fuera del horario o en una ausencia;
- imposible solapar dos citas del mismo profesional;
- cada profesional ve solo sus citas, y de sus compañeros solo "Ocupado";
- Patricia ve y gestiona todas;
- mover, cancelar o marcar "no se presentó" queda registrado con quién y cuándo.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Visibilidad | Cada profesional ve y gestiona solo sus citas. Puede activar la agenda de compañeros para ver sus citas activas como **"Ocupado" con hora**, sin paciente ni servicio. La propietaria ve y gestiona todas. Se aplica en la base de datos. |
| Recurrencia | **No en 3a.** Cada cita se crea una a una. |
| Fuera de horario o en ausencia | Se permite **con aviso** y confirmación. La reserva web (3b) solo ofrecerá huecos dentro del horario. |
| Solapes | Nunca dos citas activas (no canceladas) del mismo profesional a la vez. Lo impide la base de datos. |
| Estados | **Programada**, **Cancelada** (quién: paciente o clínica; cuándo; motivo opcional) y **No se presentó** (manual, solo cuando la hora ya pasó). Una cita pasada que no está cancelada ni marcada "no se presentó" cuenta como hecha. Las citas no se borran. |
| Mover | Cambia fecha, hora o duración. El historial guarda el antes y el después. |
| Precio | Al crear la cita se copian el precio y el tratamiento de IVA del servicio. La pieza 4 cobra lo acordado aunque la tarifa cambie después. |
| Modelo | Citas ligadas al profesional (`profile`). Las salas (v1.1) se añadirán como columna, sin rehacer. Modalidad `presencial`/`online` preparada; en 3a todas son presenciales. |
| Datos reales | Solo en local y en dev con datos inventados, hasta revisar la región de Supabase y el RGPD (spec v1, sección 5). |

## 3. Esquema

### `appointments`

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | clave |
| `professional_id` | uuid → `profiles` | obligatorio |
| `patient_id` | uuid → `people` | obligatorio; la persona debe tener `is_patient = true` y no estar archivada al crear (trigger) |
| `service_id` | uuid → `services` | obligatorio; el servicio debe estar activo al crear |
| `starts_at`, `ends_at` | timestamptz | `ends_at > starts_at`; duración de 5 a 480 minutos, múltiplo de 5 |
| `status` | enum `scheduled`, `cancelled`, `no_show` | por defecto `scheduled` |
| `cancelled_by` | enum `patient`, `clinic`, nulo | obligatorio si `cancelled` |
| `cancelled_at` | timestamptz, nulo | obligatorio si `cancelled` |
| `cancel_reason` | text | por defecto `''` |
| `modality` | enum `in_person`, `online` | por defecto `in_person` |
| `notes` | text | por defecto `''` |
| `price_cents`, `vat` | integer, `vat_treatment` | copiados del servicio al crear (trigger) |
| `created_by` | uuid | forzado a `auth.uid()` |
| `created_at`, `updated_at` | timestamptz | |

Restricciones:
- **Sin solapes:** exclusión GiST `(professional_id with =, tstzrange(starts_at, ends_at) with &&) where (status <> 'cancelled')`.
- **`no_show` solo si la cita ya empezó:** `starts_at <= now()`, comprobado en el trigger al cambiar de estado.
- **Una cita cancelada no vuelve a programarse.** Si hace falta, se crea una nueva.
- **Una cita pasada no se mueve.**

Índices: `(professional_id, starts_at)` y `(patient_id, starts_at)`.

### `appointment_events` (historial)

| Columna | Tipo |
|---|---|
| `id` | uuid |
| `appointment_id` | uuid → `appointments` (cascade) |
| `kind` | enum `created`, `moved`, `cancelled`, `no_show`, `restored` (deshacer "no se presentó") |
| `previous_starts_at`, `previous_ends_at` | timestamptz, nulos (solo en `moved`) |
| `actor_id` | uuid (= `auth.uid()`) |
| `created_at` | timestamptz |

Lo escriben solo los triggers de `appointments` (`security definer`). Nadie los inserta ni edita a mano.

### Permisos (RLS)

- `appointments`:
  - `select`, `insert` y `update`: `public.is_owner() or (public.is_active_staff() and professional_id = auth.uid())`;
  - sin `delete` para nadie.
- `appointment_events`: `select` con la misma condición sobre su cita.
- `public.agenda_busy(p_from timestamptz, p_to timestamptz)`:
  - `security definer`, exige `is_active_staff()`;
  - devuelve **solo** `professional_id, starts_at, ends_at` de las citas no canceladas que tocan el intervalo, de profesionales activos;
  - el intervalo máximo es de 31 días.
- Horarios, ausencias y servicios ya son legibles por el personal activo (pieza 1).
- Las personas, por el personal activo (pieza 2).

## 4. Reglas puras (con tests)

- **`dayBounds(date)` y `weekBounds(date)`:** instantes de inicio y fin en `Europe/Madrid`, incluidos los días de cambio de hora. Se reutiliza `madridDayBounds` del admin si encaja; si no, pasa a un paquete compartido.
- **`scheduleWarnings({ start, end, schedules, timeOff })`:** devuelve avisos:
  - "Queda fuera del horario de {nombre}";
  - "{nombre} tiene una ausencia ese día ({motivo})".
- **`layoutDay(appointments, busy)`:** posición vertical (minutos desde la primera hora visible) y altura de cada bloque; los bloques de "Ocupado" ajenos se distinguen de las citas propias.
- **`parseAppointmentForm(formData)`:**
  - obliga a elegir paciente, servicio, profesional, fecha y hora;
  - la duración va de 5 a 480 minutos, en pasos de 5;
  - el inicio es la fecha y hora en Madrid convertidas a instante.
- **`canMarkNoShow(appointment, now)`** y **`canMove(appointment, now)`**.

## 5. Pantallas del dashboard

Menú: **Agenda · Pacientes**. La agenda es la portada del dashboard (`/`).

**Agenda** (`/`, con `?date=AAAA-MM-DD&view=day|week&with=id,id&appointment=id`):
- Cabecera: flechas de día o semana anterior y siguiente, título ("Jueves, 25 de septiembre"), selector Día/Semana y "Nueva cita".
- **Vista de día:**
  - una columna por persona visible: el propio profesional más los compañeros activados; la propietaria ve a todos por defecto;
  - cada columna muestra nombre y especialidad;
  - franjas de 15 minutos con horas marcadas, entre la hora más temprana y la más tardía de los horarios visibles;
  - la línea roja de la hora actual cuando es hoy;
  - fuera de horario, sombreado suave;
  - ausencias, bloque rayado "No disponible · motivo";
  - citas propias con el color de su especialidad;
  - canceladas, ocultas; "no se presentó", atenuadas;
  - citas de compañeros, bloque neutro "Ocupado".
- **Vista de semana:** una persona (la propia o la elegida), con los siete días en columnas.
- **"Ver también":** casillas con los compañeros activos (solo para empleados). La elección se guarda en la URL.
- **Móvil (390 px):** la vista de día pasa a lista por persona; la de semana, a lista por día.
- **Panel de la cita** (`?appointment=id`, a la derecha en escritorio y a pantalla completa en móvil):
  - hora y profesional, paciente (enlace a su ficha), servicio y duración, modalidad, notas y estado;
  - acciones: **Mover** (fecha, hora y duración, con los mismos avisos), **Cancelar** (quién cancela: paciente o clínica, y motivo; con confirmación) y **No se presentó** (solo si ya pasó la hora; con confirmación);
  - un bloque "Pago" con el precio acordado y el texto "Los cobros llegarán pronto" (pieza 4);
  - el historial de la cita.

**Nueva cita** (`/appointments/new`, con `?date&time&professional` si se viene de pulsar un hueco):
- **Paciente:** buscador de personas pacientes no archivadas (mismo estilo que el de tutores de la pieza 2) o "Nueva persona", que vuelve al formulario con la persona elegida.
- **Profesional:** fijo para un empleado; selector para la propietaria.
- **Servicio:** los activos de la especialidad del profesional.
- **Fecha, hora y duración:** la duración, del servicio y ajustable.
- **Notas.**
- Avisos de horario o ausencia con "Dar la cita igualmente".
- Error de solape: "{nombre} ya tiene una cita de 17:00 a 18:00." El formulario conserva lo escrito.

**Ficha del paciente (pieza 2):** el historial muestra sus próximas citas y las pasadas (fecha, hora, servicio, profesional y estado), solo las que el usuario puede ver: las propias, o todas si es la propietaria.

## 6. Pruebas

- **pgTAP:**
  - un empleado lee y crea citas propias, pero no las de otro (ni insertando con otro `professional_id`);
  - la propietaria, todas;
  - `agenda_busy` no devuelve paciente ni servicio y exige personal activo;
  - no hay solapes entre citas activas, pero sí se puede reservar encima de una cancelada;
  - `no_show` solo si la cita ya empezó;
  - una cancelada no vuelve a programarse;
  - el precio se copia del servicio;
  - el historial se escribe solo y no se puede tocar;
  - sin segundo paso, nada.
- **Vitest:** límites de día y semana en Madrid (incluidos cambios de hora), avisos, disposición del día, formulario, `canMarkNoShow` y `canMove`.
- **e2e:**
  - un empleado da una cita desde un hueco, la ve, la mueve y la cancela (paciente), y el historial lo refleja;
  - un solape da el error;
  - una cita fuera de horario pide confirmación;
  - un compañero activado aparece como "Ocupado", sin nombre;
  - la propietaria ve las citas de todos;
  - "no se presentó" en una cita pasada;
  - la ficha del paciente muestra la cita;
  - los tests crean y borran sus datos.
- **Seed local:** citas inventadas de la semana en curso para las tres cuentas, con los pacientes de la familia de ejemplo.

## 7. Fuera de esta pieza

- Citas recurrentes.
- Reserva web y área de paciente (3b).
- Recordatorios y calendario ICS (3c).
- Cobros, señal y devoluciones (pieza 4).
- Facturas (pieza 5).
- Salas y videollamada (v1.1).
- Arrastrar y soltar para mover citas. En 3a se mueve con el formulario; se puede añadir después.
