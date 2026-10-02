# Drawers en el admin y el panel · Diseño

Fecha: 2026-10-02 · Estado: aprobado en conversación

## 1. Objetivo

Quitar la edición inline del admin (`apps/admin`) y del panel (`apps/dashboard`). En su lugar, los formularios se abren en un drawer: en escritorio sale por la derecha y en móvil sube desde abajo. Así todo se comporta igual en las dos apps.

**Éxito:**
- ninguna fila de lista se convierte en formulario;
- las altas del admin se abren con un botón «Nuevo…», y la página muestra solo la lista;
- el panel de la cita y «Registrar cobro» usan el mismo drawer;
- en una pantalla de 390 px el drawer sube desde abajo; desde `sm` (640 px) sale por la derecha.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Componente | `Sheet` (`packages/ui`) pasa a llamarse **`Drawer`**. Sigue usando Radix Dialog, así que conserva el foco atrapado, Escape, cerrar tocando fuera y el botón «Cerrar». |
| Dirección | Se decide **solo con CSS**. En móvil va pegado abajo (`inset-x-0 bottom-0`), con `max-h-[90dvh]`, esquinas superiores redondeadas y animación `slide-in-bottom`. Desde `sm` va pegado a la derecha (`inset-y-0 right-0`, `w-[26rem]`) con `slide-in-right`, como ahora. Sin JS ni `matchMedia`, así que no hay saltos al hidratar. |
| Apertura | Se puede controlar con `open`/`onOpenChange` (el panel de la cita se abre desde la URL) o pasar un `trigger`, como en `Dialog`. Para los formularios: al guardar bien se cierra; si hay error, sigue abierto y muestra el error dentro. |
| Arrastrar | No se puede cerrar arrastrando: hacerlo con vaul pide JS para cambiar de dirección. Se puede añadir más adelante si se echa en falta. |
| Drawers apilados | No. Cobrar, Factura completa y Enviar por email siguen desplegándose dentro del drawer de la cita. |
| Páginas | Servicio (nuevo y editar), paciente (nuevo y editar) y nueva cita siguen siendo páginas: son formularios largos y tienen su propia URL. Horarios y Ajustes de la clínica tampoco cambian. |
| Movimiento reducido | Con `motion-reduce` no hay animación, igual que ahora. |

## 3. Pantallas

- **Panel → Agenda:** `AppointmentPanel` usa `Drawer` en lugar de `Sheet`. El comportamiento no cambia salvo la dirección en móvil.
- **Panel → Cobros y ficha del paciente:** `RegisterPaymentDialog` pasa de `Dialog` a `Drawer`, con los mismos pasos (elegir cita y cobrar).
- **Panel → Ficha del paciente:** «Añadir tutor» abre un drawer con el buscador, el parentesco, «Guardar» y «Cancelar».
- **Admin → Especialidades:**
  - «Editar» abre un drawer con el nombre;
  - «Nueva especialidad» pasa a ser un botón arriba de la lista que abre un drawer;
  - la fila ya no tiene modo edición.
- **Admin → Equipo:**
  - «Editar» abre un drawer con nombre, especialidad y nº de colegiado;
  - «Invitar a un empleado» pasa a ser un botón que abre un drawer.
- **Admin → Horarios:**
  - «Añadir ausencia» y «Añadir día de cierre» pasan a ser botones que abren su formulario en un drawer;
  - el editor semanal se queda en la página.

Los `data-testid` que ya existen se conservan. Los botones que abren drawers nuevos llevan el suyo (`specialty-new`, `member-invite`, `time-off-new`, `closure-new`, `guardian-add`).

## 4. Pruebas

- **Vitest (`packages/ui`):** `drawer.test.tsx` parte de `sheet.test.tsx` (nombre y descripción accesibles, foco atrapado, Escape, botón «Cerrar») y añade la apertura con `trigger`.
- **e2e:** se actualizan los recorridos que usan la edición inline o las altas (`admin-errors.spec.ts`, `admin-ui.spec.ts`, los de horarios y cierres, tutores, `/cobros`). Se añade una comprobación a 390 px de que el drawer de la cita queda pegado abajo, y a 1440 px de que queda a la derecha.
- **Capturas:** del admin y del panel a 1440 px y 390 px, para revisarlos visualmente.

## 5. Commits

1. Componente `Drawer` (sustituye a `Sheet`) con dirección responsive y `trigger`.
2. Panel de la cita y Registrar cobro con `Drawer`.
3. Especialidades: editar y crear en drawer.
4. Equipo: editar e invitar en drawer.
5. Horarios: ausencias y días de cierre en drawer.
6. Añadir tutor en drawer.

## 6. Fuera

- La web pública (`apps/web`), que seguirá usando vaul en `CollaboratorDrawer`.
- Cerrar arrastrando.
- Convertir páginas de formularios en drawers.
