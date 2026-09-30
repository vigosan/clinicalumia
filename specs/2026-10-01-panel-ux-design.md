# Mejora del panel (UX/UI) · Diseño

Fecha: 2026-10-01 · Estado: aprobado en conversación (decisiones del 30/09/2026)

## 1. Objetivo

Que el panel del equipo (`apps/dashboard`) se entienda sin explicaciones y se vea cuidado: un único vocabulario, siempre se sabe dónde estás, controles bonitos y accesibles, y el cobro se puede registrar desde la página de Cobros. El admin comparte `packages/ui`, así que los componentes también mejoran allí.

**Éxito:**
- un solo término por concepto en todo el panel, según el glosario;
- cada pantalla interior tiene migas de pan y un título de pestaña propio;
- no queda ningún `<select>`, fecha u hora nativos en el panel;
- "Registrar cobro" funciona desde `/cobros`;
- el panel se usa bien en el móvil.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Librería | **Radix** (ya está en `packages/ui`) con un diseño cuidado al estilo de Tailwind UI, en la línea de shadcn/ui. Nada de Headless UI. Para el buscador con autocompletado se usa `cmdk` (de Radix). Para el calendario, `react-day-picker` v9 con locale `es` dentro de un Radix Popover. Los iconos son `lucide-react`, como en shadcn. |
| Glosario | **Ficha** (el registro), **Paciente** (recibe tratamiento), **Tutor/a** ("Menores a su cargo"). Estados de cita: Programada, Realizada, Cancelada, No presentada. Cobro de una cita: Cobrada, Pendiente de cobro, Sin cargo. Registro de cobro: Válido, Anulado. "Ver citas en mi móvil" sustituye a "Mi calendario". "Ausencia" sustituye a "No disponible". |
| Migas de pan | Una prop `breadcrumbs` de `PageHeader`, no de AppShell. En el móvil se reducen a "‹ {padre}". |
| Títulos | La plantilla es `%s · LUMIA`, con un título por página. |
| Menú | Menú de usuario (Radix DropdownMenu) con "Ver citas en mi móvil" y "Cerrar sesión". Menú lateral desplegable en el móvil. El elemento activo se marca por prefijo (Nueva cita → Agenda). |
| Cobros | Botón "Registrar cobro" en `/cobros`: se elige la cita (las de hoy primero y después las pendientes, con buscador) y se muestra el `PaymentForm` que ya existe. Pestañas "Cobrados · Pendientes (n)". Se puede cobrar desde la ficha del paciente. Se puede cobrar en cualquier momento (ya implementado en la 5a). |
| Diálogos | `ConfirmDialog` gana una prop `tone`: rojo solo para acciones destructivas. El panel de la cita pasa a ser un panel lateral (Radix Dialog) con Escape y foco atrapado. |
| Avisos | Radix Toast ("Cobro registrado · 45,00 € en efectivo"). `Alert` y `EmptyState` reutilizables. |
| Errores | `error.tsx`, `not-found.tsx` y `loading.tsx` en español para el panel. |

## 3. Componentes (`packages/ui`)

- **Se rediseñan:**
  - `select` (Radix Select: marca de la opción elegida, teclado y `name` para los formularios);
  - `input` (con prefijos y sufijos);
  - `checkbox`;
  - `button` (variantes claras; `ghost` deja de parecer un enlace);
  - `confirm-dialog` (`tone`);
  - `table` (tarjetas en el móvil);
  - `page-header` (migas de pan y antetítulo);
  - `app-shell` (menú de usuario y menú lateral en el móvil).
- **Se añaden:** `breadcrumbs`, `combobox` (cmdk en Popover), `date-picker`, `date-range-picker` (con atajos Hoy, Ayer, Esta semana y Este mes), `time-select` (cada 15 minutos, se puede escribir), `radio-cards`, `switch`, `segmented-control`, `tabs`, `pagination`, `alert`, `empty-state`, `toast`, `dropdown-menu`, `sheet` (panel lateral).
- **Se mantiene:** los colores y la tipografía de marca de `brand.css`.

## 4. Pantallas

- **Textos:** se sustituyen según la tabla de la auditoría del 30/09/2026 (unos 80 textos). Los incluye el plan.
- **Pacientes:**
  - "Nuevo paciente";
  - filtro Activos / Archivados;
  - paginación;
  - resultados de búsqueda con edad y teléfono;
  - la ficha con "Citas" y "Cobros", y el botón "Nueva cita" con el paciente ya elegido.
- **Agenda:**
  - antetítulo "Agenda";
  - panel lateral;
  - "Cambiar fecha u hora";
  - calendario y hora con los componentes nuevos;
  - "Cancelar" de Nueva cita vuelve al día de origen.
- **Cobros:**
  - pestañas;
  - "Registrar cobro";
  - selector de rango de fechas;
  - totales en tarjetas.
- **Consentimientos:** filtro segmentado y textos.
- **Mi calendario:** pasa al menú de usuario como "Ver citas en mi móvil", con los textos nuevos.

## 5. Pruebas

- **Vitest:** componentes nuevos (teclado, accesibilidad básica) y utilidades (migas de pan, filtros).
- **e2e:** se actualizan los selectores de los tests que usan `selectOption` sobre selects nativos. Los `data-testid` se mantienen. Los recorridos nuevos:
  - Registrar cobro desde `/cobros`;
  - migas de pan;
  - menú de usuario.
- **Capturas:** del panel a 1440 px y 390 px para revisarlo visualmente. No son baseline de tests.

## 6. Fuera

- La web pública (`apps/web`) no cambia.
- Cambiar las rutas a español (`/patients` → `/pacientes`).
- Modo oscuro.
