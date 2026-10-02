# Diseño: admin, componentes compartidos y contraste · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aplicar al admin, a los componentes compartidos que no lleva la otra sesión y a la web las propuestas de diseño de la auditoría.

**Architecture:** `packages/ui` (toast, drawer, dialog, dropdown-menu, app-shell, nav-link, brand.css), páginas de `apps/admin` y botones de `apps/web`.

**Tech Stack:** Next.js 16, Tailwind v4, Radix, lucide-react, Vitest, Playwright.

**Spec:** `specs/2026-10-02-diseno-admin-y-componentes-design.md`

## Global Constraints

- No tocar `apps/dashboard`, `packages/ui/src/components/table.tsx` ni `page-header.tsx` (otra sesión). Si hace falta una prop nueva en ellos, se pide a esa sesión.
- Estilo LUMIA: colores y tipografía de `brand.css`, sin tarjetas dentro de tarjetas, un solo primario por vista, texto ≥ 4,5:1.
- Crear/editar en drawers.
- Reglas de la casa: textos en español, sin comentarios, `data-testid` > rol > texto, TDD, un commit por tarea con el título exacto, nunca `--no-verify`, nunca push.
- Gates: `make lint`, `make typecheck`, `make test`; e2e enfocado con el candado compartido; capturas web-visual solo si cambian a propósito.

## Review Focus

1. **Con «reducir movimiento»:** nada se desliza. Tarea 1.
2. **Toast con «Deshacer»:** accesible por teclado y no desaparece antes de poder usarlo. Tarea 1.
3. **Error del ZIP:** no mueve los botones. Tarea 2.
4. **Admin a 390 px:** sin scroll horizontal. Tarea 2.

---

### Task 1: Componentes compartidos y tokens

**Files:** `packages/ui/src/components/{toast,drawer,dialog,dropdown-menu,app-shell,nav-link}.tsx` (+ tests), `packages/ui/src/styles/brand.css`, `apps/admin/app/(admin)/layout.tsx` (iconos de la navegación).

- [ ] **Tests:** unitarias (tono, acción, contador, selección tenue, clases de salida y reducción de movimiento). **Commit:** "Pulir los avisos, las animaciones y la navegación compartidos"

---

### Task 2: Admin

**Files:** `apps/admin/app/(admin)/{page.tsx,facturacion/*,schedules/*,closures/*}`, e2e del admin, capturas a 1440 y 390 px.

- [ ] **Tests:** e2e (error del ZIP sin mover botones, total arriba, inicio con estado de la clínica, eliminar con icono y confirmación). **Commit:** "Rediseñar el admin con el estilo de LUMIA"

---

### Task 3: Contraste en la web

**Files:** botones y textos pequeños de `apps/web` por debajo de 4,5:1 (empezando por «Firmar y enviar»), capturas web-visual afectadas.

- [ ] **Tests:** unitarias o e2e de contraste si es viable (cálculo con los colores de marca); capturas actualizadas a propósito. **Commit:** "Cumplir el contraste AA en la web"
