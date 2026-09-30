# Pieza 6 — Consentimientos · Diseño

Fecha: 2026-09-30 · Estado: pendiente de revisión

Parte de la plataforma LUMIA v1 (`specs/2026-09-25-plataforma-lumia-v1-design.md`, pieza 6: "el formulario actual pasa a guardarse en la ficha del paciente además de enviarse por email; listado en el dashboard"). Solo depende de la pieza 2 (personas y tutela).

## 1. Objetivo

Que cada consentimiento firmado en `www.clinicalumia.es/consentimiento` quede guardado, con su PDF firmado, en la ficha del paciente. Si no se puede asociar solo, que el equipo lo haga desde un listado.

**Éxito:**
- cada consentimiento firmado queda guardado, aunque no se pueda asociar;
- se asocia solo cuando la coincidencia es segura, y nunca a la persona equivocada por una coincidencia dudosa;
- el equipo ve todos los consentimientos, filtra los pendientes y los asocia a una ficha existente o nueva;
- en la ficha del paciente se ven sus consentimientos, qué autorizó y el PDF.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Dónde se firma | Solo en la web, en `/consentimiento`, como hasta ahora. La página y su diseño no cambian. |
| Email | Se sigue enviando a la clínica con el PDF adjunto, como ahora. Ahora usa `sendEmail` (Resend en producción y Mailpit en local), así que en local deja de enviar por Resend. |
| Guardado | El consentimiento se guarda antes de enviar el email. Si falla el guardado, el paciente ve un error y lo reintenta. Si falla solo el email, el consentimiento queda guardado, se muestra como enviado y el fallo se registra. |
| Asociación automática | Solo con una coincidencia segura (sección 4). En cualquier otro caso queda "Pendiente de asociar". |
| Asociación manual | Desde el listado del panel: unir a una ficha existente, crear una ficha con los datos (con el aviso de duplicados de la pieza 2) o desasociar. |
| PDF | Se guarda en un bucket privado de Supabase Storage, `consents`. Solo lo lee el equipo, con enlaces firmados de 5 minutos. |
| Quién lo ve | Todo el personal activo con 2FA (`is_active_staff()`), como las fichas. |

## 3. Datos

- **`consents`:**
  - `id`, `signed_at`;
  - lo que se escribió en el formulario: `first_name`, `last_name`, `birth_date`, `tax_id`, `email`, `guardian_name`, `sources` (text[]);
  - lo que autorizó: `privacy_accepted` (siempre `true`), `marketing`, `media_for_training`;
  - `pdf_path` (ruta en el bucket);
  - `person_id` (→ `people`, `on delete set null`), `linked_at`, `linked_by` (→ `profiles`, nulo si fue automático), `link_method` (enum `auto_tax_id`, `auto_guardian`, `auto_email`, `manual`);
  - `created_at`.
  - RLS: `select` y `update` de `person_id`, `linked_at`, `linked_by` y `link_method` solo para `is_active_staff()`, a través de funciones. Nadie inserta desde el cliente: la web guarda con la clave de servicio.
- **Bucket `consents`:** privado. Solo `is_active_staff()` puede hacer `select` sobre `storage.objects` de ese bucket, y solo el servidor escribe.
- **Funciones:**
  - `link_consent(p_consent_id, p_person_id)` y `unlink_consent(p_consent_id)`: solo `is_active_staff()`. Registran `linked_by = auth.uid()` y `link_method = 'manual'`.
  - `match_consent_person(p_tax_id, p_email, p_birth_date)`: solo `service_role`. Devuelve `(person_id, method)` o nada, con las reglas de la sección 4.

## 4. Asociación automática

Al guardar, en este orden y solo si el resultado es **una única** ficha no archivada:

1. **Por DNI:** una persona con ese `tax_id`, normalizado igual que en la ficha. Si además la fecha de nacimiento del formulario coincide con la suya, se asocia (`auto_tax_id`).
2. **Menor firmado con el DNI del tutor:** si el DNI es de una persona que es tutora de exactamente un menor con esa fecha de nacimiento, se asocia al menor (`auto_guardian`).
3. **Por email:** si no hubo coincidencia por DNI, una única persona con ese email y esa fecha de nacimiento (`auto_email`).

Hay un caso especial: el DNI coincide con una ficha pero la fecha de nacimiento no, y no es el caso del tutor. Entonces queda pendiente, porque puede ser un error al escribir.

## 5. Panel

- **Menú "Consentimientos"** (`/consentimientos`):
  - listado con fecha de firma, nombre y apellidos, DNI y estado ("Asociado a <ficha>" con enlace, o "Pendiente de asociar");
  - filtro "Solo pendientes", activo por defecto si hay alguno;
  - búsqueda por nombre o DNI;
  - paginación como la de pacientes;
  - "Ver PDF".
- **Detalle de un consentimiento** (`/consentimientos/<id>`):
  - los datos del formulario y lo que autorizó ("Publicidad: sí/no", "Imágenes para formación: sí/no");
  - el PDF;
  - si está pendiente: buscador de fichas (el de las citas) → "Asociar"; o "Crear ficha con estos datos", que abre el alta de paciente de la pieza 2 con los datos rellenos, pasa por el aviso de duplicados y asocia el consentimiento al guardar;
  - si está asociado: "Desasociar" con confirmación.
- **Ficha del paciente:** apartado "Consentimientos", con la fecha de firma, las autorizaciones y "Ver PDF". Si no tiene ninguno: "Sin consentimientos firmados".

## 6. Seguridad y RGPD

- El PDF y los datos son de categoría especial (salud y menores). Nunca son públicos: bucket privado y enlaces firmados de 5 minutos, generados en el servidor para personal activo.
- La web guarda con la clave de servicio, solo en el servidor. La acción mantiene el campo trampa (`website`) contra bots.
- Los pacientes no ven sus consentimientos en Mi cuenta en esta pieza.
- No se borran consentimientos desde el panel. Si se borra una ficha, el consentimiento queda sin asociar (`on delete set null`) y el PDF se conserva.

## 7. Pruebas

- **pgTAP:**
  - `match_consent_person` en cada regla: DNI con fecha que coincide y que no; tutor con un menor y con dos; email con fecha; varias coincidencias; archivadas;
  - permisos: `anon` y un paciente no leen `consents` ni el bucket; el personal lee; solo el personal asocia y desasocia.
- **Vitest:**
  - la acción de la web guarda, sube el PDF, asocia y envía el email;
  - un fallo del email no pierde el consentimiento;
  - un fallo del guardado devuelve error;
  - las acciones del panel.
- **e2e:**
  - firmar en `/consentimiento` con el DNI de una ficha existente → aparece asociado en su ficha con el PDF;
  - firmar con datos nuevos → aparece pendiente en el listado → "Crear ficha con estos datos" → queda asociado;
  - firmar con un DNI y otra fecha → pendiente → asociar a mano a la ficha correcta → desasociar;
  - llega el email a Mailpit con el PDF.

## 8. Fuera de esta pieza

- Revocar un consentimiento o registrar cambios de autorización.
- Firmar desde la clínica (tablet) con los datos ya rellenos.
- Ver los consentimientos en Mi cuenta.
- Plantillas de consentimiento distintas por especialidad.
