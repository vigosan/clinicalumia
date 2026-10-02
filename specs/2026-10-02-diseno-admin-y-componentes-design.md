# Diseño: admin, componentes compartidos y contraste · Diseño

Fecha: 2026-10-02 · Estado: aprobado («soluciona todo»)

Cuarta pieza de la auditoría del 01/10/2026 (`specs/auditoria/2026-10-01-diseno.md`, IDs de propuesta entre paréntesis). El rediseño del panel (`apps/dashboard`), las tablas (`table.tsx`) y la cabecera de página (`page-header.tsx`) los lleva otra sesión en la rama `rediseno-panel`; esta pieza no los toca.

## 1. Objetivo

Que el admin siga el estilo sencillo de LUMIA, que los componentes compartidos se sientan acabados (avisos, animaciones, navegación) y que todo el texto cumpla el contraste AA.

## 2. Decisiones

| Tema | Decisión | Propuestas |
|------|----------|------------|
| Avisos | `toast(message, { tone: "success" \| "error", action? })`. El de error usa el icono de alerta en `danger-600`, dura 8 s y no se cierra solo si tiene acción. La acción («Deshacer») es un botón dentro del aviso. | T4 |
| Animaciones de salida | Drawer, Dialog, DropdownMenu y Toast salen en 150 ms (`ease-in`), deslizando o con un fundido y `scale(0.98)`. Con «reducir movimiento», solo fundido. | T3 |
| Navegación | `NavItem` admite `icon` (Lucide, 18 px) y `count` opcional (pastilla). La selección es tenue (`bg-sage-100`, texto `sage-900`, peso 500, barra interior de 3 px) para que el botón principal sea lo único oliva. La barra lateral del admin usa iconos. Los contadores del panel (Consentimientos pendientes, Cobros pendientes) se conectan en la rama del panel. | N1, N2 |
| Tokens | `brand.css` añade `--color-text-tertiary: #6a6a6a` (≥4,5:1 sobre crema) y `--color-separator: #d6d0c6`, y los usan los componentes de esta pieza; el texto pequeño con `ink-700` pasa a `text-tertiary` en ellos. | §4 |
| Admin › Facturación | El error del ZIP sale como aviso de error bajo la cabecera o como toast, sin mover los botones; los botones tienen ancho fijo y «Preparando…» con indicador. El total neto del trimestre pasa arriba como cifra grande junto al selector; los recuentos por tipo son una línea tipográfica, no tarjetas. | AD1, AD2 |
| Admin › Inicio | Pasa a «estado de la clínica»: lo pendiente de configurar (ya existe), el próximo trimestre a presentar con su fecha, el próximo cierre y accesos a Equipo y Servicios; sin repetir la navegación en tarjetas. | AD3 |
| Admin › Horarios y Cierres | Eliminar es un botón de icono (papelera, rojo solo al pasar) con confirmación; los plegables usan chevron animado; los avisos de citas afectadas muestran 4 y «y N más». | AD4 |
| Contraste en la web | «Firmar y enviar» y cualquier botón o texto pequeño de la web por debajo de 4,5:1 se corrigen con los colores de marca. | §1.7 |

## 3. Fuera

Todo `apps/dashboard`, `table.tsx` y `page-header.tsx` (rama `rediseno-panel`).

## 4. Pruebas

Unitarias de componentes (tono, acción, contador, clases de salida); e2e del admin (Facturación con error sin mover botones, inicio con su estado, eliminar desde icono); capturas web-visual actualizadas a propósito solo donde cambia el contraste; capturas a 1440 y 390 px del admin para revisarlas.
