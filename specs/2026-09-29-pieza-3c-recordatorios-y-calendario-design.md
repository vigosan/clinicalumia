# Pieza 3c — Recordatorios y calendario · Diseño

Fecha: 2026-09-29 · Estado: pendiente de revisión

Parte de la plataforma LUMIA v1 (`specs/2026-09-25-plataforma-lumia-v1-design.md`, pieza 3: "recordatorios por email y suscripción ICS por empleado"). Depende de:

- **3a:** citas y agenda.
- **3b:** cuentas de paciente, Mi cuenta, `sendEmail` y los textos del plazo.

## 1. Objetivo

- **Que los pacientes no se olviden de sus citas:** un recordatorio por email el día antes y un archivo para añadir la cita a su calendario.
- **Que cada profesional vea sus citas en el móvil** sin abrir el panel: un calendario de solo lectura al que se suscribe una vez.

**Éxito:**
- cada cita del día siguiente recibe un único recordatorio, aunque la tarea se ejecute dos veces;
- una cita cancelada o movida a otro día no recibe el recordatorio;
- el calendario del profesional refleja los cambios de la agenda sin hacer nada;
- un enlace de calendario robado se puede invalidar;
- añadir SMS más adelante no obliga a rehacer los recordatorios.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| A quién se avisa | Solo a pacientes (o a su madre, padre o tutor). El equipo no recibe recordatorios; usa el calendario. |
| Canal | Email ahora. Cada envío se registra con su canal (`email`; `sms` queda previsto) para añadir SMS después sin cambiar el modelo. |
| Cuándo | Una vez al día, con las citas del día siguiente (hora de Madrid). Lo lanza Vercel Cron (el plan Hobby permite una ejecución diaria) a las 08:00 UTC: 10:00 en verano y 09:00 en invierno. |
| Calendario del equipo | Un enlace secreto por profesional, `https://panel.clinicalumia.es/calendario/<token>.ics`. Cada evento lleva el **nombre completo del paciente y el servicio**. Es una decisión consciente de la clínica: esos datos quedan en el calendario del móvil del profesional (Google o Apple). No se incluyen notas, teléfonos ni emails. |
| Calendario del paciente | Un `.ics` de la cita adjunto a "Cita confirmada" y al recordatorio, y un enlace "Añadir a mi calendario" en Mi cuenta. |

## 3. Datos

- **`appointment_reminders`:**
  - campos: `id`, `appointment_id` (→ `appointments`, `on delete cascade`), `channel` (enum `email`, `sms`), `recipient` (text), `sent_at` (timestamptz, nulo si falló), `error` (text), `created_at`;
  - un índice único parcial `(appointment_id, channel) where sent_at is not null` impide un segundo envío correcto por canal;
  - solo la escribe y lee el servidor, con la clave de servicio. Tiene RLS activado y sin políticas, y se revoca a `anon` y `authenticated`. El dashboard no la muestra en esta pieza.
- **`profiles.calendar_token`:**
  - texto aleatorio de 32 bytes en base64url, único y nulo hasta que se genera;
  - `regenerate_my_calendar_token()` (personal activo, aal2) genera o cambia el propio token y lo devuelve;
  - `revoke_calendar_token(p_profile_id)` (solo la propietaria) lo pone a nulo;
  - se revoca el `SELECT` de la columna a `anon` y `authenticated`; cada profesional lee el suyo con `my_calendar_token()` y nadie lee los ajenos.

## 4. Recordatorio diario

- **Ruta:** `apps/web/app/api/cron/recordatorios/route.ts` (GET, que es como llama Vercel Cron).
  - Exige `Authorization: Bearer ${CRON_SECRET}`; sin él, `401`.
  - En `vercel.json` de la web: `{"crons":[{"path":"/api/cron/recordatorios","schedule":"0 8 * * *"}]}`.
- **Selección:** citas con `status = 'scheduled'` cuyo inicio cae en el día siguiente de Madrid, sin un envío correcto por `email` en `appointment_reminders`.
- **Destinatario de cada cita**, por orden:
  1. el email de la cuenta de paciente que la reservó, si existe (`booked_by_account`);
  2. el email de la persona;
  3. si la persona no tiene email, los emails de sus tutores (uno o varios).

  Si no hay ningún email, se registra `error = 'sin_email'` y no se envía.
- **Email "Recordatorio de tu cita":**
  - "Te recordamos la cita de <persona> mañana, <día> a las <hora>";
  - servicio, profesional y dirección de la clínica;
  - el texto del plazo de la 3b ("Puedes cambiarla o cancelarla hasta…" o "Fuera de plazo: llama al…");
  - un enlace "Ver Mi cuenta";
  - el `.ics` adjunto.
- **Registro:** una fila por cita y destinatario, con `sent_at` si Resend (o Mailpit en local) acepta el envío, o `error` si no.
  - Una ejecución repetida no reenvía: el índice único y la selección se lo impiden.
  - Un fallo se reintenta en la siguiente ejecución, solo si la cita sigue siendo "mañana".
- **Respuesta:** `{ sent, failed, skipped }`, sin datos personales.
- `sendEmail` gana adjuntos (`attachments: { filename, content, contentType }[]`) para Resend y Mailpit.

## 5. Calendario del profesional

- **Ruta:** `apps/dashboard/app/calendario/[token]/route.ts`. Fuera del grupo con sesión, porque Google y Apple no tienen sesión.
  - Busca el perfil por `calendar_token` con la clave de servicio. Si no existe o el perfil no está activo, `404`.
  - Devuelve `text/calendar; charset=utf-8` con sus citas no canceladas entre hoy − 30 días y hoy + 90 días.
- **Evento:**
  - `SUMMARY` "Nombre Apellidos · Servicio";
  - `DTSTART` y `DTEND` en UTC;
  - `UID` `<appointment_id>@clinicalumia.es`;
  - `DTSTAMP` con la última actualización;
  - `STATUS:CONFIRMED`;
  - sin descripción ni ubicación personal.

  Las ausencias no se incluyen.
- **Página "Mi calendario"** en el panel (`/mi-calendario`, en el menú):
  - "Generar enlace" o el enlace actual con "Copiar";
  - instrucciones cortas para Google Calendar ("Añadir calendario → Desde URL") y para el iPhone;
  - "Cambiar enlace", que invalida el anterior.
- **Admin, Equipo:** la propietaria puede "Invalidar el calendario" de cualquier miembro. Al desactivar a un miembro también se invalida.

## 6. `.ics` del paciente

- Generador puro compartido, `@clinicalumia/api/ics`: `appointmentEvent({ id, startsAt, endsAt, summary, location, description })` y `calendar(events, name)`, con saltos de línea CRLF, líneas plegadas a 75 octetos y texto escapado.
- **Adjunto:** "Cita confirmada" (reserva y cambio) y el recordatorio llevan `cita.ics`. `SUMMARY` "Cita en Clínica LUMIA · Servicio", `LOCATION` con la dirección de la clínica y `UID` fijo por cita, para que al cambiar la hora se actualice el evento en vez de duplicarse.
- **Mi cuenta:** en cada cita próxima, "Añadir a mi calendario" (`/mi-cuenta/citas/<id>/cita.ics`), servido solo si la cita es de la cuenta (`my_appointments`).

## 7. Seguridad

- La ruta del cron no hace nada sin `CRON_SECRET`, que es un secreto solo de servidor en Vercel y en local.
- Los tokens de calendario son largos y aleatorios, y se pueden cambiar e invalidar. Un token desconocido da `404` sin distinguir los motivos.
- El calendario del profesional no incluye notas, teléfonos, emails, motivos de ausencia ni datos de pago.
- `appointment_reminders` guarda el email de destino (necesario para auditar) y solo lo ve el servidor.
- El `.ics` de Mi cuenta solo se sirve para citas de la cuenta.

## 8. Pruebas

- **pgTAP:**
  - tokens: solo el propio, la propietaria invalida y los tokens ajenos no se leen;
  - `appointment_reminders`: no legible por `anon` ni `authenticated`, y el índice único impide dos envíos correctos.
- **Vitest:**
  - generador ICS: plegado, escape, UTC, y citas en los dos días de cambio de hora;
  - selección de citas de "mañana" en hora de Madrid, incluidos los cambios de hora;
  - orden de destinatarios;
  - texto del recordatorio;
  - la ruta del cron sin secreto da `401`.
- **e2e:**
  - llamar a la ruta del cron con el secreto envía un recordatorio a Mailpit con `.ics` y registra el envío; una segunda llamada no reenvía; una cita cancelada no recibe nada;
  - un menor sin email hace llegar el recordatorio al tutor;
  - un profesional genera su enlace y el `.ics` trae sus citas con nombre y servicio y sin notas; al cambiar el enlace, el antiguo da `404`;
  - "Añadir a mi calendario" en Mi cuenta descarga el `.ics`; otra cuenta recibe `404`.

## 9. Fuera de esta pieza

- Envío real de SMS o WhatsApp: el modelo está preparado.
- Recordatorios al equipo.
- Editar citas desde el calendario (es de solo lectura).
- Recordatorios más precisos ("24 h antes"), que necesitarían `pg_cron` o un plan de Vercel de pago.
