# Pieza 2 — Pacientes · Diseño

Fecha: 2026-09-27 · Estado: pendiente de revisión

Parte de la plataforma LUMIA v1 (`specs/2026-09-25-plataforma-lumia-v1-design.md`, sección 3, pieza 2). Depende de la pieza 1: dashboard, acceso con verificación en dos pasos y `packages/ui`.

## 1. Objetivo

Que el equipo tenga **una ficha única por persona**, sin duplicados, para que la agenda, los cobros, las facturas y los consentimientos se apoyen en ella sin rehacerla.

Los menores quedan ligados a su tutor o tutores.

**Éxito:**
- crear, buscar, editar y archivar pacientes desde el dashboard;
- el formulario avisa antes de crear un posible duplicado y la base de datos impide dos personas con el mismo DNI/NIE;
- un menor muestra a sus tutores y un tutor muestra a los menores a su cargo;
- una madre con dos hijos es una sola persona.

## 2. Decisiones

| Tema | Decisión |
|------|----------|
| Modelo | **Personas y tutela**: pacientes y tutores son personas; una relación de tutela une menor y tutor. Un tutor puede ser también paciente. |
| Historial | En esta pieza, **actividad** (citas, cobros, facturas y consentimientos, que aparecen con las piezas 3 a 6) y **notas administrativas** cortas. Hasta la pieza 3 la actividad está vacía. |
| Notas clínicas | **Fuera de esta pieza.** Son historia clínica: conservación, secreto profesional por especialidad y registro de accesos. Irán en una pieza propia, junto al registro de accesos de la v1.1. |
| Duplicados | DNI/NIE único en la base de datos. Email y teléfono **no** son únicos, porque una familia los comparte: el formulario avisa de coincidencias y deja elegir la persona existente o continuar. |
| Acceso | Personal activo con segundo paso (`is_active_staff()`): ver, crear y editar. Solo la propietaria (`is_owner()`): borrar. En el día a día se **archiva**, no se borra. |
| Menor | Se calcula con la fecha de nacimiento: menos de 18 años en la fecha de hoy, en `Europe/Madrid`. |
| Datos reales | Solo en local y en `lumia-db-dev` con datos inventados, hasta revisar la región de Supabase y el RGPD (spec v1, sección 5). |

## 3. Esquema

### `people` (personas)

| Columna | Tipo | Reglas |
|---|---|---|
| `id` | uuid | clave |
| `first_name`, `last_name` | text | obligatorios, sin espacios sobrantes |
| `birth_date` | date | obligatoria si `is_patient`; opcional para quien solo es tutor; no puede ser futura |
| `tax_id` | text | DNI/NIE/CIF normalizado (mayúsculas, sin espacios ni guiones); único cuando no es nulo |
| `email` | text | en minúsculas; opcional |
| `phone` | text | solo dígitos, con `+` opcional al principio; opcional |
| `address` | text | opcional |
| `admin_notes` | text | notas administrativas, por defecto `''` |
| `is_patient` | boolean | si recibe atención; un tutor que no es paciente tiene `false` |
| `archived_at` | timestamptz | nulo mientras está activa |
| `search_text` | text generado | nombre, apellidos, DNI, email y teléfono en minúsculas y sin acentos, para buscar |
| `created_at`, `updated_at`, `created_by` | | `created_by` es el miembro del equipo que la creó |

Índices:
- único parcial en `tax_id`;
- trigram (`pg_trgm`) sobre `search_text`;
- índices simples en `email` y `phone`, para detectar duplicados.

### `guardianships` (tutela)

| Columna | Tipo | Reglas |
|---|---|---|
| `minor_id` | uuid → `people` | on delete cascade |
| `guardian_id` | uuid → `people` | on delete restrict |
| `relationship` | enum `madre`, `padre`, `tutor_legal`, `otro` | |
| `is_primary` | boolean | como mucho un tutor principal por menor (índice único parcial) |

Además:
- clave primaria (`minor_id`, `guardian_id`);
- `check (minor_id <> guardian_id)`.

### Funciones

- `find_possible_duplicates(p_tax_id text, p_email text, p_phone text, p_exclude uuid default null)`, `security invoker`.
  - Devuelve las personas no archivadas cuyo DNI, email o teléfono normalizado coincide, y dice en qué campo coinciden.
  - Si la persona tiene menores a su cargo, también devuelve sus nombres, para mostrar "madre de Pablo".
- Normalización en base de datos: un trigger rellena `tax_id`, `email` y `phone` normalizados. La app normaliza igual, pero la base de datos es la que decide.

### Permisos (RLS)

- `select`, `insert` y `update` en `people` y `guardianships`: `is_active_staff()`.
- `delete`: `is_owner()`.

Ningún permiso depende solo de haber iniciado sesión. La pieza 1 ya exige el segundo paso y una sesión viva dentro de `is_active_staff()`.

## 4. Reglas de negocio (funciones puras con tests)

- `parsePersonForm(formData)`:
  - valida y normaliza nombre, apellidos, fecha (no futura; obligatoria si es paciente), DNI/NIE (reutiliza `isValidSpanishTaxId`, que pasa del admin a un paquete compartido), email y teléfono;
  - acepta teléfonos españoles escritos con espacios, guiones o `+34`.
- `isMinor(birthDate, today)`: con fecha en `Europe/Madrid`, incluido el día del cumpleaños.
- Un menor **paciente** sin tutor se puede guardar, pero su ficha muestra el aviso "Menor sin tutor" hasta que se añada uno.
- Un tutor debe ser mayor de edad si tiene fecha de nacimiento.

## 5. Pantallas del dashboard

Nueva sección **Pacientes** en el menú del dashboard, con el mismo estilo que el admin.

- **Listado** `/patients`:
  - buscador por nombre, DNI, teléfono o email, sin acentos ni mayúsculas;
  - filtro "Archivados";
  - cada fila muestra nombre, edad, teléfono y la etiqueta "Menor" cuando toca;
  - a 390px las filas se apilan.
- **Alta** `/patients/new`:
  - formulario de persona;
  - al salir de DNI, email o teléfono, busca posibles duplicados y los muestra con "Usar esta persona" o "Es otra persona, continuar".
- **Ficha** `/patients/[id]`:
  - datos y notas administrativas;
  - tutores (con parentesco y principal) o menores a su cargo;
  - "Añadir tutor" (buscar persona existente o crear nueva) y "Quitar";
  - historial vacío con el texto "Aquí aparecerán sus citas, cobros y facturas";
  - acciones Editar y Archivar/Recuperar;
  - "Eliminar" solo para la propietaria, con confirmación, y solo si no hay nada ligado.
- **Edición** `/patients/[id]/edit`: mismo formulario y mismo aviso de duplicados, excluyendo a la propia persona.

## 6. Pruebas

- **pgTAP:**
  - una empleada activa con segundo paso lee, crea y edita, pero no borra;
  - la propietaria borra;
  - sin segundo paso, o con la cuenta desactivada, no se ve nada;
  - el DNI es único;
  - la normalización del trigger funciona;
  - una persona no puede ser tutora de sí misma;
  - un menor tiene un solo tutor principal;
  - `find_possible_duplicates` encuentra por cada campo y no devuelve personas archivadas.
- **Vitest:** `parsePersonForm`, `isMinor` y la normalización del teléfono.
- **e2e (Playwright):**
  - alta de un adulto;
  - alta con un teléfono ya existente → aviso → "Usar esta persona";
  - alta de un menor → añadir a su madre como tutora → la ficha de la madre muestra al menor;
  - búsqueda sin acentos;
  - archivar y recuperar.

  Los tests crean y borran sus propios datos.
- **Seed local:** una familia (madre con dos hijos menores, uno de ellos paciente de logopedia y otro de fisioterapia) y dos adultos. Todo inventado.

## 7. Fuera de esta pieza

- Notas clínicas e historia clínica.
- Registro de accesos a fichas (v1.1).
- Área de paciente y alta desde la web (pieza 3).
- Citas en el historial (pieza 3).
- Cobros y facturas a nombre del tutor (piezas 4 y 5).
- Consentimientos ligados a la ficha (pieza 6).
- Fusionar duplicados ya creados. El aviso previo y el DNI único los evitan; si hace falta, se añadirá una fusión más adelante.
