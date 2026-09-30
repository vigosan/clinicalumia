# Pieza 6 — Consentimientos · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guardar cada consentimiento firmado en la web, con su PDF, asociarlo solo a la ficha del paciente cuando la coincidencia es segura, y dar al equipo un listado para asociar los pendientes.

**Architecture:**
- **Base de datos:** tabla `consents`, bucket privado `consents`, la función de coincidencia `match_consent_person` (solo `service_role`) y las funciones del equipo `link_consent` y `unlink_consent`.
- **Web:** la acción `sendConsent` guarda con la clave de servicio, sube el PDF, asocia y envía el email con `sendEmail`.
- **Panel:** listado, detalle con asociación manual y apartado en la ficha del paciente.

**Tech Stack:** Supabase (Postgres, Storage, pgTAP) · Next.js 16 · Vitest · Playwright.

**Spec:** `specs/2026-09-30-pieza-6-consentimientos-design.md`. Base: `main` df4cee2 (piezas 1 a 3 completas).

## Global Constraints

- **Migraciones:** una sola nueva, `20261002090000_consentimientos.sql`, que se edita en el sitio mientras no salga de la rama. `make db.types` y `make db.types.check` en verde. Nada se aplica en remoto.
- **Permisos:**
  - lectura de `consents` y del bucket `consents`: solo `is_active_staff()`;
  - escritura: solo el servidor de la web (clave de servicio) y las funciones `link_consent` / `unlink_consent` (personal activo);
  - `revoke all` a `anon` y `authenticated` sobre la tabla, excepto la política de `select` para el personal.
- **Funciones:** `security definer`, `set search_path = ''`, nombres cualificados. `match_consent_person` solo para `service_role`; `link_consent` y `unlink_consent` solo para `authenticated`, comprobando `is_active_staff()`.
- **Coincidencia automática** (sección 4 de la spec), siempre con una única ficha no archivada:
  1. DNI y fecha de nacimiento → `auto_tax_id`;
  2. DNI de un tutor con exactamente un menor con esa fecha → `auto_guardian`;
  3. sin coincidencia por DNI: email y fecha de nacimiento → `auto_email`.

  El DNI se normaliza igual que en `people` (mayúsculas, sin espacios ni guiones). Un DNI que coincide con una ficha adulta con otra fecha de nacimiento, y que no es el caso del tutor, queda pendiente.
- **PDF:** ruta `consents/<yyyy>/<mm>/<consent_id>.pdf` en el bucket `consents`, tipo `application/pdf`. En el panel se sirve con `createSignedUrl` de 300 segundos, generado en el servidor.
- **Web:** `/consentimiento` no cambia de aspecto (`web-visual` verde). El email a la clínica mantiene destinatario, asunto, texto y adjunto, pero se envía con `sendEmail` (`@clinicalumia/api/email`).
- **e2e:** datos propios, limpieza completa (consentimientos, objetos del bucket y personas), en paralelo; nunca se toca el seed.
- **Reglas de la casa:** textos en español; sin comentarios; `data-testid` > rol > etiqueta; commits pequeños con título descriptivo en español, sin cuerpo; nunca `--no-verify`.
- **Gates:**
  - siempre: `make lint` (0 avisos), `make typecheck`, `make test` y `make test.db`;
  - en tareas con pantallas, además `make test.e2e` dos veces, vigilando el reloj de Docker.

## Review Focus

1. **Asociación equivocada:** un DNI mal escrito que coincide con otra persona, dos menores del mismo tutor con la misma fecha, o un email compartido por una familia nunca asocian automáticamente. Tests en la Tarea 1.
2. **Nada se pierde:** si falla el email, el consentimiento queda guardado; si falla la subida del PDF, no queda una fila sin PDF. Tests en la Tarea 2.
3. **Privacidad:** ni `anon`, ni un paciente, ni un enlace público pueden leer consentimientos o PDF; los enlaces firmados caducan. Tests en las Tareas 1 y 3.
4. **Ficha borrada:** el consentimiento queda sin asociar y se puede volver a asociar. Tests en la Tarea 1.
5. **Crear ficha desde un pendiente:** pasa por el aviso de duplicados y, al guardar, asocia el consentimiento; si se cancela, el consentimiento sigue pendiente. Tests en la Tarea 4.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/db/supabase/migrations/20261002090000_consentimientos.sql` | Tabla, bucket, políticas y funciones (crear). |
| `packages/db/supabase/tests/consents.test.sql` | pgTAP (crear). |
| `apps/web/app/actions.ts`, `apps/web/lib/consent-store.ts` (+ test) | Guardar, subir, asociar y enviar (modificar/crear). |
| `apps/dashboard/app/(app)/consentimientos/**`, `apps/dashboard/lib/consents.ts` (+ test) | Listado, detalle y acciones (crear). |
| `apps/dashboard/app/(app)/patients/[id]/page.tsx` (+ componente) | Apartado en la ficha (modificar). |
| `apps/dashboard/app/(app)/patients/new/*`, `patients/actions.ts` | Crear ficha desde un consentimiento (modificar). |
| `e2e/consents.spec.ts` | Recorridos (crear). |

---

### Task 1: Esquema de consentimientos y coincidencia

**Files:**
- Create: `packages/db/supabase/migrations/20261002090000_consentimientos.sql`, `packages/db/supabase/tests/consents.test.sql`
- Modify: `packages/db/types.ts`

**Interfaces:**
- Produces:
  - Enum `public.consent_link_method` (`auto_tax_id`, `auto_guardian`, `auto_email`, `manual`).
  - Tabla `public.consents`:
    - columnas: `id uuid pk default gen_random_uuid()`, `signed_at timestamptz not null`, `first_name text not null`, `last_name text not null`, `birth_date date not null`, `tax_id text not null`, `email text`, `guardian_name text not null default ''`, `sources text[] not null default '{}'`, `privacy_accepted boolean not null default true`, `marketing boolean not null`, `media_for_training boolean not null`, `pdf_path text not null`, `person_id uuid references public.people on delete set null`, `linked_at timestamptz`, `linked_by uuid references public.profiles on delete set null`, `link_method public.consent_link_method`, `created_at timestamptz not null default now()`;
    - check: `person_id` nulo ⇔ `link_method` nulo; se tolera el caso de un `on delete set null` sobre `person_id`, pasando `link_method` a nulo con un trigger `before update`;
    - índices en `(person_id)`, `(signed_at desc)` y `(tax_id)`;
    - RLS con una sola política de `select` para `authenticated` con `is_active_staff()`; `revoke insert, update, delete` a `anon` y `authenticated`.
  - Bucket de storage `consents`: `public = false`, `allowed_mime_types = '{application/pdf}'`, límite de 5 MB. Política de `select` en `storage.objects` para `authenticated` con `bucket_id = 'consents' and public.is_active_staff()`, y ninguna de escritura para clientes.
  - `public.match_consent_person(p_tax_id text, p_email text, p_birth_date date)` → `table (person_id uuid, method public.consent_link_method)`: 0 o 1 filas según las reglas de las Global Constraints, solo `service_role`.
  - `public.link_consent(p_consent_id uuid, p_person_id uuid)` → `void`:
    - personal activo, si no `42501`;
    - la persona existe y no está archivada, si no `person_not_found`; el consentimiento existe, si no `consent_not_found`;
    - rellena `person_id`, `linked_at = now()`, `linked_by = auth.uid()` y `link_method = 'manual'`.
  - `public.unlink_consent(p_consent_id uuid)` → `void`: personal activo; pone a nulo los cuatro campos.

- [ ] **Step 1: pgTAP que falla.**
  - `match_consent_person`:
    - adulto con DNI y fecha → `auto_tax_id`;
    - DNI con otra fecha → 0 filas;
    - DNI de un tutor con un menor de esa fecha → el menor, con `auto_guardian`; con dos menores de esa fecha → 0 filas;
    - sin DNI coincidente, email y fecha → `auto_email`; dos personas con ese email y fecha → 0 filas;
    - una persona archivada no cuenta;
    - el DNI con espacios o guion en minúscula coincide;
  - permisos:
    - `anon` y un paciente (sesión de `patient_accounts`) no leen `consents` ni `storage.objects` del bucket;
    - una empleada con aal2 lee;
    - una sesión aal1 no lee;
    - `link_consent` y `unlink_consent` funcionan para el personal y dan `42501` a un paciente;
    - `match_consent_person` no es ejecutable por `authenticated`;
  - borrar la persona asociada deja `person_id` y `link_method` a nulo.
- [ ] **Step 2: migración, `make db.reset`, `make db.types`, tests en verde. Step 3: commit**

```bash
git commit -m "Guardar consentimientos y buscar su ficha solo cuando la coincidencia es segura"
```

---

### Task 2: Guardar el consentimiento al firmar en la web

**Files:**
- Create: `apps/web/lib/consent-store.ts`, `apps/web/lib/consent-store.test.ts`
- Modify: `apps/web/app/actions.ts` (`sendConsent`), `apps/web/app/actions.test.ts` si existe

**Interfaces:**
- Consumes:
  - `parseConsent` y `buildConsentPdf` (ya existen);
  - `createAdminClient` (`@clinicalumia/api/admin`) y `sendEmail` con adjuntos (`@clinicalumia/api/email`);
  - `match_consent_person` (Tarea 1).
- Produces:
  - `storeConsent({ admin, consent, signedAt, pdf })` → `{ id: string; personId: string | null }`:
    1. genera el `id`;
    2. sube el PDF a `consents/<yyyy>/<mm>/<id>.pdf` en el bucket `consents`;
    3. busca la coincidencia;
    4. inserta la fila con `person_id`, `linked_at` y `link_method` si la hubo.

    Si la inserción falla, borra el PDF subido y lanza el error. Si la subida falla, lanza el error sin insertar.
  - `sendConsent`: tras validar y generar el PDF, llama a `storeConsent`. Si lanza, devuelve `{ error: "No se ha podido guardar el consentimiento. Inténtalo de nuevo." }`. Si no, envía el email con `sendEmail`, con el mismo destinatario (`CONSENT_TO_EMAIL` o `site.email`), asunto, texto y adjunto que ahora. Si el email falla, lo registra con `console.error` y devuelve `{ ok: true }`. El remitente lo decide `sendEmail`, así que desaparecen `CONSENT_FROM_EMAIL` y el `onboarding@resend.dev` antiguo.

- [ ] **Step 1: tests que fallan** (unitarios, con el cliente simulado):
  - el orden subir → coincidir → insertar;
  - con coincidencia se asocia;
  - si falla la inserción, se borra el PDF;
  - si falla la subida, no se inserta;
  - un fallo del email devuelve `ok`;
  - un fallo del guardado devuelve el error;
  - el campo trampa sigue sin guardar nada.
- [ ] **Step 2: implementar. Step 3: `make test`, lint y typecheck; commit**

```bash
git commit -m "Guardar en la clínica cada consentimiento firmado en la web"
```

---

### Task 3: Listado y detalle de consentimientos en el panel

**Files:**
- Create: `apps/dashboard/lib/consents.ts` (+ test), `apps/dashboard/app/(app)/consentimientos/page.tsx`, `consentimientos/[id]/page.tsx`, `consentimientos/actions.ts` (+ test), `e2e/consents.spec.ts`
- Modify: `apps/dashboard/app/(app)/layout.tsx` (menú "Consentimientos")

**Interfaces:**
- Consumes:
  - `consents` (RLS de personal), `link_consent` y `unlink_consent`;
  - `supabase.storage.from('consents').createSignedUrl(path, 300)`;
  - el buscador de pacientes de las citas (`PatientPicker` o `searchGuardianCandidates`), reutilizado.
- Produces:
  - `/consentimientos`:
    - tabla (`consents-list`) con fecha, nombre, DNI y estado ("Asociado a <nombre>" con enlace a la ficha, o "Pendiente de asociar");
    - filtro `?pendientes=1` (`consents-pending-filter`), activo por defecto si hay pendientes;
    - búsqueda `?q=` por nombre o DNI;
    - paginación de 25 como en pacientes.
  - `/consentimientos/<id>`:
    - datos del formulario (`consent-details`) y autorizaciones;
    - "Ver PDF" (`consent-pdf`, enlace firmado);
    - si está pendiente: `consent-link-picker` y "Asociar" (`consent-link`);
    - si está asociado: "Desasociar" (`consent-unlink`) con `ConfirmDialog`;
    - un id desconocido da `notFound()`.
  - `linkConsent(consentId, personId)` y `unlinkConsent(consentId)`, acciones de servidor que traducen `person_not_found` y `consent_not_found` y revalidan.

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** acciones y consultas.
  - **e2e:** con consentimientos de usar y tirar creados con la clave de servicio (con PDF subido):
    - una empleada de usar y tirar ve el pendiente en el listado;
    - lo asocia a una ficha;
    - aparece "Asociado a …";
    - lo desasocia;
    - "Ver PDF" devuelve un PDF (200, `application/pdf`);
    - la URL pública del bucket sin firma da 400/404.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Ver y asociar los consentimientos desde el panel"
```

---

### Task 4: Crear ficha desde un consentimiento y apartado en la ficha

**Files:**
- Modify:
  - `apps/dashboard/app/(app)/patients/new/*` (acepta `?consentimiento=<id>`);
  - `apps/dashboard/app/(app)/patients/actions.ts` (al crear con ese parámetro, asocia);
  - `apps/dashboard/app/(app)/patients/[id]/page.tsx` y un componente nuevo `ConsentsSection.tsx`;
  - `consentimientos/[id]/page.tsx` (botón "Crear ficha con estos datos", `consent-create-person`);
  - `e2e/consents.spec.ts`.

**Interfaces:**
- Produces:
  - "Crear ficha con estos datos" lleva a `/patients/new?consentimiento=<id>`:
    - el formulario de la pieza 2 viene relleno con nombre, apellidos, fecha, DNI y email;
    - si es menor, el nombre del tutor se muestra como ayuda;
    - pasa por el aviso de duplicados como siempre;
    - al guardar, llama a `link_consent` con la nueva persona y vuelve al consentimiento;
    - cancelar deja el consentimiento pendiente.
  - En la ficha, el apartado "Consentimientos" (`patient-consents`) muestra cada consentimiento con fecha, "Publicidad: sí/no", "Imágenes para formación: sí/no" y "Ver PDF". Si no hay: "Sin consentimientos firmados".

- [ ] **Step 1: tests que fallan.**
  - **Unitarios:** la acción de alta con consentimiento asocia; sin él, no.
  - **e2e:**
    - firmar en `/consentimiento` (la página real de la web) con el DNI y la fecha de una ficha existente → la ficha muestra el consentimiento y llega a Mailpit el email con el PDF;
    - firmar con datos nuevos → pendiente → "Crear ficha con estos datos" → la ficha nueva lo muestra;
    - firmar con un DNI existente y otra fecha → pendiente.
- [ ] **Step 2: implementar. Step 3: gates y e2e ×2; commit**

```bash
git commit -m "Crear la ficha desde un consentimiento y mostrarlos en la ficha del paciente"
```

---

## Publicación (fuera del plan, con confirmación)

- La migración 20261002090000 se sube a dev y producción con las demás.
- El bucket `consents` lo crea la migración. Hay que comprobar en producción que queda privado.
