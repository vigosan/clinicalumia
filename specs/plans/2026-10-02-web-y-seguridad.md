# Web, permisos y seguridad · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir los hallazgos de web, permisos y seguridad de la auditoría.

**Architecture:** Límites en acciones de servidor de la web (tabla `access_requests`), funciones y políticas SQL, pantallas de la web, del panel y del admin, y un script de mantenimiento.

**Tech Stack:** Supabase (Postgres, RLS, Auth, pgTAP), Next.js 16, Resend/Mailpit, Vitest, Playwright.

**Spec:** `specs/2026-10-02-web-y-seguridad-design.md`

## Global Constraints

- Migraciones nuevas con prefijo `20261011…`; funciones recreadas desde su última definición.
- Nuevas superficies de crear/editar en panel y admin, dentro de `@clinicalumia/ui/drawer`.
- Ningún dato personal en URLs ni registros.
- Reglas de la casa: textos en español, sin comentarios, `data-testid` > rol > texto, TDD, un commit por tarea con el título exacto, nunca `--no-verify`, nunca push.
- Gates: `make lint`, `make typecheck`, `make test`, `make test.db`; e2e enfocado por el implementador con el candado compartido; completo por el controlador.

## Review Focus

1. **Límites que bloquean a pacientes legítimos:** el aviso es claro y da el teléfono. Tarea 1.
2. **Consentimiento sin JavaScript:** nunca envía datos por GET. Tarea 2.
3. **Menor con email propio:** no reserva solo, pero su tutor/a sí puede. Tarea 3.
4. **Empleada con la API directa:** no puede archivar, eliminar ni quitar tutores. Tarea 3.
5. **Script de 2FA:** solo con confirmación explícita y sin tocar a otras personas. Tarea 4.

---

### Task 1: Límites anti-abuso y cuenta al verificar

**Files:** `apps/web/app/acceder/*`, `apps/web/app/actions.ts` (consentimiento), tabla/funciones de `access_requests`, componente de captcha opcional (Turnstile) desactivado sin claves, migración, pgTAP, unitarias, e2e.

- [ ] **Tests:** límite global de códigos, límite del consentimiento, cuenta creada solo tras verificar, captcha ausente sin claves. **Commit:** "Limitar los formularios públicos y crear la cuenta al verificar"

---

### Task 2: Consentimiento y web del paciente

**Files:** `apps/web/app/consentimiento/*`, `apps/web/lib/consent*.ts`, cabecera y pie de la web, `/reservar` (textos, plazo, quién atiende, calendario), `/acceder` (caducado con `next`), emails de confirmación, panel (asociar consentimiento que completa la ficha), e2e (y capturas web-visual si cambian).

- [ ] **Tests:** unitarias (DNI, plazo, textos) y e2e (copia al paciente, POST sin JS, Mi cuenta, plazo visible, caducado conserva la reserva, asociación completa la ficha). **Commit:** "Mejorar el consentimiento y orientar al paciente en la web"

---

### Task 3: Menores y permisos del equipo

**Files:** migración (`book_appointment` para menores, políticas de `people`/tutelas para archivar/eliminar/quitar tutor, `person_upcoming_appointments` solo propietaria, motivo de ausencia solo propietaria), panel (acciones visibles según rol, agenda «Ausencia»), pgTAP, e2e.

- [ ] **Tests:** pgTAP (menor sin tutor no reserva; empleada no archiva por API; motivo oculto); e2e (botones ocultos a la empleada; «Ausencia» sin motivo). **Commit:** "Ajustar los permisos de menores y del equipo"

---

### Task 4: Equipo, datos de la clínica y recuperación del 2FA

**Files:** admin `team` (estado de invitación, textos), `booking_catalog` o el filtro de profesionales (no ofrecer invitadas sin activar), admin `clinic` (errores junto al campo, CP, selector de numeración), `Makefile` + script `db.owner.reset-mfa`, `specs/operacion.md`, pantalla de 2FA, pgTAP, e2e.

- [ ] **Tests:** e2e (invitación pendiente y aceptada, invitada no reservable, errores de datos de la clínica, selector de numeración); prueba local del script. **Commit:** "Aclarar el equipo y los datos de la clínica y recuperar el 2FA de la propietaria"
