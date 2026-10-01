# Días de cierre de la clínica · Diseño

Fecha: 2026-10-01 · Estado: aprobado en conversación

Pieza pendiente de la plataforma LUMIA v1 (`specs/2026-09-25-plataforma-lumia-v1-design.md`). Hoy solo existen ausencias por profesional (`employee_time_off`); falta poder cerrar la clínica entera en festivos y vacaciones.

## 1. Objetivo

La propietaria apunta a mano los días en que la clínica cierra. Esos días nadie puede reservar desde la web ni mover su cita a ellos, y la agenda del equipo los marca.

**Éxito:**
- un día cerrado no ofrece huecos en la reserva web ni en el cambio de cita del área de paciente;
- la agenda muestra «Clínica cerrada · {motivo}»;
- al crear un cierre, la propietaria ve qué citas ya hay esos días.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Alta | Solo a mano, en el admin. Sin precarga de festivos ni servicios externos. |
| Forma | Un día o un rango de días (`starts_on`, `ends_on`, ambos incluidos) con un motivo obligatorio de hasta 80 caracteres. |
| Fechas | Días del calendario en Europe/Madrid. Un cierre del 24/12 cubre de 24/12 00:00 a 25/12 00:00 en Madrid. |
| Reserva web y área de paciente | Sin huecos en días cerrados: se excluyen en `_free_slots`, que usan la reserva y el cambio de cita. |
| Citas del equipo | Se pueden seguir dando (casos excepcionales). «Nueva cita» avisa si la fecha está cerrada, sin impedirlo. |
| Citas existentes | Al crear un cierre, el admin lista las citas no canceladas de esos días. No se cancela nada automáticamente. |
| Permisos | Lectura: personal activo (`is_active_staff()`). Escritura: propietaria (`is_owner()`). Sin acceso anónimo; las funciones de reserva son `security definer`. |
| Solapes | No se permiten dos cierres que se solapen (restricción de exclusión). |

## 3. Pantallas

- **Admin › Horarios:** sección «Días de cierre» con un formulario (rango de fechas con el selector compartido y motivo) y la lista. Primero los próximos, en orden; los pasados plegados en «Cierres anteriores». Cada cierre se puede borrar con confirmación. Tras crear uno con citas afectadas, se muestra un aviso con la lista (fecha, hora, paciente, profesional) para revisarlas en la agenda del panel (sin enlace directo: el admin no conoce la URL del panel).
- **Panel › Agenda:** en día y semana, un día cerrado muestra una banda «Clínica cerrada · {motivo}» y las columnas sombreadas.
- **Panel › Nueva cita:** si la fecha elegida está cerrada, un aviso «La clínica está cerrada ese día ({motivo}). Puedes dar la cita igualmente.».

## 4. Datos

Tabla `clinic_closures (id, starts_on date, ends_on date, reason text, created_at, created_by)` con `check (starts_on <= ends_on)`, exclusión de solapes con `daterange(starts_on, ends_on, '[]')`, RLS como en §2.

## 5. Pruebas

- **pgTAP:** permisos; solapes rechazados; `available_slots` y `my_reschedule_slots` sin huecos en un día cerrado (incluido un cierre de varios días y uno el día del cambio de hora); un día sin cierre sigue igual.
- **e2e:** crear y borrar un cierre en el admin con el aviso de citas afectadas; la web no ofrece el día cerrado; la agenda muestra la banda; «Nueva cita» avisa.

## 6. Fuera

- Precarga de festivos y calendarios externos.
- Horarios especiales (abrir medio día).
- Avisar a los pacientes afectados.
