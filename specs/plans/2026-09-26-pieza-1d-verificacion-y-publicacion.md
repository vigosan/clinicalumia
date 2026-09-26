# Pieza 1d — Verificación en dos pasos y publicación · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **La Parte B (publicación) no la ejecutan subagentes:** la hace el controlador, paso a paso, con confirmación explícita del usuario antes de cada acción remota.

**Goal:** Que todo el personal entre al admin y al dashboard con verificación en dos pasos obligatoria (TOTP), y publicar `panel.clinicalumia.es` y `admin.clinicalumia.es` contra la base de datos de producción, con la cuenta de la propietaria creada por invitación.

**Architecture:**
- **Dos barreras.**
  - *Base de datos:* `is_active_staff()` e `is_owner()` exigen que la sesión sea `aal2`. Sin verificar el segundo paso no se lee ni se escribe nada, aunque el código de la app fallara.
  - *Aplicación:* el `proxy` de cada app decide la ruta con una función pura y compartida, `nextRoute()`: login, activar el segundo paso, pedir el código o dejar pasar.
- **Lógica y pantallas compartidas.**
  - La lógica de Supabase MFA vive en `packages/api/mfa.ts`.
  - Las pantallas de activar y pedir código son componentes de `@clinicalumia/ui`. Cada app solo añade sus rutas y acciones finas.
- **Desarrollo local.** Las cuentas sembradas tienen un factor TOTP verificado con una clave fija. `make totp` imprime el código del momento, y los e2e lo calculan con la misma clave.
- **Publicación.** Dos proyectos nuevos de Vercel con la carpeta de su app. Producción recibe las migraciones y la configuración de login por los comandos con guarda que ya existen. La propietaria se crea en producción con una **invitación** (nunca con una contraseña escrita en la terminal).

**Tech Stack:** Supabase Auth MFA (TOTP) · Postgres RLS · Next.js 16 `proxy` · `@clinicalumia/ui` · Vitest · pgTAP · Playwright + `otpauth` (solo en desarrollo) · Vercel CLI · Resend (SMTP).

**Spec:** `specs/2026-09-25-plataforma-lumia-v1-design.md`, secciones 4.3 (acceso y seguridad), 4.6 (publicación), 4.7 (pruebas) y 6 (tareas externas).

**Planes anteriores:** 1a (entorno, migraciones y acceso), 1b (sistema de diseño) y 1c (configuración del admin), todos en `main`.

## Global Constraints

- La verificación en dos pasos (TOTP con app de autenticación) es **obligatoria para todo el personal**, en admin y dashboard (spec 4.3). No hay forma de saltarla desde la app.
- Todo cambio de base de datos es una migración en `packages/db/supabase/migrations`; `make db.types` y `make db.types.check` en verde tras cada una.
- Ningún permiso depende de "haber iniciado sesión" sin más. Desde este plan, tampoco de haber pasado solo la contraseña: sin `aal2` no hay datos.
- Nunca se imprime ni se pega un secreto (claves de servicio, `RESEND_API_KEY`, URL de base de datos, `.env.*`) en la terminal, el chat ni el código. `packages/db/.env.dev` y `.env.prod` no se leen en voz alta.
- **Acciones remotas solo con confirmación explícita del usuario en el chat, una por una:**
  - `make db.push.*` y `make db.config.*`;
  - cualquier `vercel` que cree o cambie algo (`project add`, `env`, `domains`, `deploy`, `link`);
  - `git push`;
  - invitar a la propietaria en producción.

  Los subagentes de la Parte A no hacen ninguna.
- Redirecciones solo a rutas internas: el parámetro `next` debe empezar por `/` y no por `//`.
- Textos en español, sin comentarios en el código; tests con `data-testid` > rol > etiqueta; commits pequeños con título descriptivo en español, sin cuerpo ni prefijos; nunca `--no-verify`.
- Gates antes de cada commit: `make lint` (0 avisos), `make typecheck`, `make test`, `make test.db`; `make test.e2e` (con los workers por defecto) en las tareas que tocan pantallas o login.
- Docker: `export PATH="$HOME/.orbstack/bin:$PATH"`. Supabase local lee `config.toml` y las plantillas de la carpeta desde la que se arranca. Mientras dura este plan se arranca desde el worktree `pieza-1d`, porque TOTP solo está activado ahí. Tras fusionar, el controlador lo rearranca desde la carpeta principal: si se borra el worktree con Supabase arrancado desde él, los emails dejan de enviarse.

## Review Focus

1. **Un enlace de recuperación de contraseña no puede saltarse el segundo paso.** Quien tenga el email de alguien del equipo no debe poder entrar solo con el enlace: si la cuenta ya tiene el factor, pide el código antes de dejar cambiar la contraseña. Tests en las Tareas 3 y 6.
2. **Una sesión que solo ha pasado la contraseña (aal1) no ve ni cambia datos**, ni por la app ni llamando a la API de Supabase directamente. Tests en la Tarea 1.
3. **Redirección abierta:** `?next=//evil.com` o `?next=https://evil.com` tras el código deben llevar a `/`. Tests en la Tarea 3.
4. **Activar el segundo paso dos veces** (recargar la página, volver atrás) no puede dejar factores sin verificar acumulados que bloqueen la activación. Tests en la Tarea 4.
5. **Móvil perdido:** la propietaria puede restablecer el segundo paso de un empleado (no el suyo desde la app; para ella hay procedimiento en la Parte B). Tests en la Tarea 7.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `packages/db/supabase/config.toml` | TOTP activado; SMTP de Resend en dev y prod (modificar). |
| `packages/db/supabase/migrations/20260926120000_exigir_dos_pasos.sql` | `is_active_staff()` e `is_owner()` exigen `aal2` (crear). |
| `packages/db/supabase/tests/*.test.sql` | `act_as` con `aal2`; nuevo `mfa.test.sql` (modificar/crear). |
| `packages/db/supabase/seed.sql` | Factor TOTP verificado para las cuentas sembradas (modificar). |
| `packages/db/scripts/totp.ts`, `invite-owner.ts` | Código TOTP de desarrollo; invitación de la propietaria (crear). |
| `packages/api/route.ts` (+ test) | `nextRoute()`: decisión pura de a dónde va cada petición (crear). |
| `packages/api/mfa.ts` (+ test) | Paso pendiente, activar y verificar TOTP (crear). |
| `packages/api/proxy.ts` | Devuelve también el paso de verificación (modificar). |
| `packages/ui/src/components/two-factor-setup.tsx`, `two-factor-challenge.tsx` (+ tests) | Pantallas de activar y de pedir código (crear). |
| `apps/{admin,dashboard}/proxy.ts` | Usan `nextRoute()` (modificar). |
| `apps/{admin,dashboard}/app/auth/dos-pasos/**` | Rutas y acciones del segundo paso (crear). |
| `apps/{admin,dashboard}/app/login/actions.ts` | Tras la contraseña, al segundo paso (modificar). |
| `apps/dashboard/app/auth/confirm/route.ts` | La recuperación pasa por el segundo paso si hay factor (modificar). |
| `apps/admin/app/(admin)/team/**` | Restablecer el segundo paso de un empleado (modificar). |
| `e2e/auth.ts` y specs | Login común con código TOTP; recorridos nuevos (crear/modificar). |
| `Makefile`, `scripts/dev-banner.sh` | `make totp`, `db.owner.prod`, exportar `RESEND_API_KEY` en `db.config.*` (modificar). |

---

# Parte A — Código (subagentes)

### Task 1: La base de datos exige el segundo paso

**Files:**
- Create: `packages/db/supabase/migrations/20260926120000_exigir_dos_pasos.sql`, `packages/db/supabase/tests/mfa.test.sql`
- Modify: `packages/db/supabase/config.toml` (`[auth.mfa.totp] enroll_enabled = true`, `verify_enabled = true`), `packages/db/supabase/tests/{permissions,services,schedules,clinic_settings,seed}.test.sql` (el helper `act_as`)

**Interfaces:**
- Produces: `public.is_active_staff()` y `public.is_owner()` devuelven `false` si `auth.jwt()->>'aal'` no es `'aal2'`. En los tests, `pg_temp.act_as(user_id uuid, aal text default 'aal2')`.

- [ ] **Step 1: pgTAP que falla**

`packages/db/supabase/tests/mfa.test.sql`. Usa el mismo arranque que `services.test.sql`: una propietaria y una empleada activas, con UUIDs `40000000-…`, y el helper con nivel:

```sql
create or replace function pg_temp.act_as(user_id uuid, aal text default 'aal2') returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated', 'aal', aal)::text, true);
$$;
```

Aserciones (cada una con un mensaje que explique por qué importa):
- con `aal1`, la empleada ve 0 filas en `specialties`, `services`, `employee_schedules` y `clinic_settings`, y 0 en `profiles` (ni la suya): la contraseña sola no da acceso a datos;
- con `aal1`, la propietaria no puede actualizar `clinic_settings` (0 filas afectadas; comprueba el valor como `postgres` tras `reset role`) y `set_employee_schedule` lanza `42501`;
- con `aal1`, `public.is_owner()` y `public.is_active_staff()` devuelven `false`;
- con `aal2`, las mismas lecturas y la actualización funcionan.

Run: `make db.reset && make test.db` → Expected: FAIL (con `aal1` todavía se ven datos).

- [ ] **Step 2: Migración**

```sql
create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2'
    and exists (
      select 1 from public.profiles where id = auth.uid() and is_active
    );
$$;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(auth.jwt()->>'aal', '') = 'aal2'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'owner' and is_active
    );
$$;
```

Comprueba con `grep -rn "auth.uid()" packages/db/supabase/migrations` si alguna política da acceso **sin** pasar por estas funciones (por ejemplo `profiles_select_self_or_owner` con `id = auth.uid()`). Si la hay, cámbiala en esta misma migración para que también exija `aal2`, y añade su aserción a `mfa.test.sql`.

- [ ] **Step 3: Los tests existentes pasan a `aal2`**

En cada `*.test.sql`, el helper `act_as` añade `'aal', 'aal2'` a los claims, igual que el del Step 1, y conserva su firma actual con un parámetro. Así esos tests siguen probando lo mismo que antes. Activa TOTP en `config.toml`.

Run: `make db.stop && make db.start` desde el worktree (cambia `config.toml`), `make db.reset && make test.db && make db.types && make db.types.check` → Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/db
git commit -m "Exigir la verificación en dos pasos para leer y cambiar datos"
```

---

### Task 2: Cuentas de desarrollo con segundo paso y `make totp`

**Files:**
- Modify: `packages/db/supabase/seed.sql`, `packages/db/supabase/tests/seed.test.sql`, `packages/db/package.json`, `Makefile`, `scripts/dev-banner.sh`
- Create: `packages/db/scripts/totp.ts`, `packages/db/scripts/totp.test.ts`

**Interfaces:**
- Produces: en local, las tres cuentas sembradas tienen un factor TOTP **verificado** con la clave `DEV_TOTP_SECRET = "JBSWY3DPEHPK3PXP"`. `currentTotp(secret: string, at?: Date): string` en `packages/db/scripts/totp.ts`. `make totp` imprime el código actual y los segundos que le quedan.

- [ ] **Step 1: Tests que fallan**

- `seed.test.sql`: las tres cuentas sembradas tienen exactamente un factor `totp` con `status = 'verified'` en `auth.mfa_factors`, para que el login local funcione igual que en producción.
- `totp.test.ts`: con el vector del RFC 6238 (SHA-1, clave ASCII `12345678901234567890`, en base32 `GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ`, instante `59` s), el código es `287082` con 6 dígitos. Además, dos instantes dentro de la misma ventana de 30 s dan el mismo código.

- [ ] **Step 2: Implementar**

- `seed.sql`: inserta en `auth.mfa_factors`, con UUIDs fijos, un factor por cuenta: `factor_type 'totp'`, `status 'verified'`, `friendly_name 'App de autenticación'`, `secret` con la clave de desarrollo, más `created_at` y `updated_at`. Mira antes las columnas reales con `\d auth.mfa_factors` en local. Si la clave se guarda cifrada en esta versión, para y repórtalo.
- `totp.ts`: usa `otpauth` (devDependency de `@clinicalumia/db`) para `currentTotp`. El `main` del script imprime el código de `DEV_TOTP_SECRET` y los segundos que le quedan.
- `Makefile`: objetivo `totp` (`## Código de verificación de las cuentas de desarrollo`) que ejecuta el script.
- `dev-banner.sh`: una línea nueva: `Dos pasos    make totp (clave JBSWY3DPEHPK3PXP para tu app)`.

Run: `make db.reset && make test.db && make test && make totp` → Expected: PASS e imprime un código de 6 dígitos.

- [ ] **Step 3: Commit**

```bash
git add packages/db Makefile scripts/dev-banner.sh pnpm-lock.yaml
git commit -m "Sembrar el segundo paso en las cuentas de desarrollo y añadir make totp"
```

---

### Task 3: Decidir la ruta según la sesión

**Files:**
- Create: `packages/api/route.ts`, `packages/api/route.test.ts`, `packages/api/mfa.ts`, `packages/api/mfa.test.ts`
- Modify: `packages/api/proxy.ts`, `packages/api/package.json` (exports si hace falta), `apps/admin/proxy.ts`, `apps/dashboard/proxy.ts`

**Interfaces:**
- Produces:
  - `type MfaStep = "enroll" | "challenge" | "done"`
  - `getMfaStep(supabase): Promise<MfaStep>`: usa `supabase.auth.mfa.getAuthenticatorAssuranceLevel()`. `currentLevel aal2` da `done`; `aal1` con `nextLevel aal2` da `challenge`; `aal1` con `nextLevel aal1` da `enroll`.
  - `safeNext(value: string | null): string`: devuelve el valor si empieza por `/` y no por `//` ni `/\`; si no, `/`.
  - `nextRoute({ path, search, signedIn, step }): { redirect: string } | null`.
  - `updateSession()` devuelve además `step: MfaStep | null` (`null` sin sesión).

- [ ] **Step 1: Tests que fallan**

`route.test.ts` fija esta tabla:

| Sesión | Ruta | Resultado |
|---|---|---|
| sin sesión | `/services` | `/login` |
| sin sesión | `/login`, `/login/recuperar`, `/auth/confirm` | sin redirección |
| sin sesión | `/auth/dos-pasos`, `/auth/contrasena` | `/login` (no son públicas sin sesión) |
| `enroll` | `/` | `/auth/dos-pasos/activar` |
| `enroll` | `/auth/contrasena`, `/auth/dos-pasos/activar` | sin redirección (quien acaba de ser invitado fija la contraseña y después activa) |
| `challenge` | `/clinic` | `/auth/dos-pasos?next=%2Fclinic` |
| `challenge` | `/auth/contrasena` | `/auth/dos-pasos?next=%2Fauth%2Fcontrasena` (Review Focus 1) |
| `challenge` | `/auth/dos-pasos` | sin redirección |
| `done` | `/login`, `/auth/dos-pasos`, `/auth/dos-pasos/activar` | `/` |
| `done` | `/services` | sin redirección |

`safeNext`:
- `"/clinic"` da `"/clinic"`;
- `"//evil.com"`, `"https://evil.com"`, `"/\\evil.com"`, `""` y `null` dan `"/"`.

`mfa.test.ts`: `getMfaStep` con las tres combinaciones de niveles, sobre un cliente simulado.

Run: `pnpm --filter @clinicalumia/api test` → Expected: FAIL.

- [ ] **Step 2: Implementar**

```ts
export type MfaStep = "enroll" | "challenge" | "done";

const PUBLIC = ["/login", "/auth/confirm"];
const ENROLL_ALLOWED = ["/auth/dos-pasos/activar", "/auth/contrasena"];

function startsWithAny(path: string, prefixes: string[]) {
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}

export function safeNext(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}

export function nextRoute({
  path,
  search,
  signedIn,
  step,
}: {
  path: string;
  search: string;
  signedIn: boolean;
  step: MfaStep | null;
}): { redirect: string } | null {
  if (!signedIn || !step) return startsWithAny(path, PUBLIC) ? null : { redirect: "/login" };
  if (step === "enroll")
    return startsWithAny(path, ENROLL_ALLOWED) || path.startsWith("/auth/confirm")
      ? null
      : { redirect: "/auth/dos-pasos/activar" };
  if (step === "challenge") {
    if (path === "/auth/dos-pasos" || path.startsWith("/auth/confirm")) return null;
    return { redirect: `/auth/dos-pasos?next=${encodeURIComponent(path + search)}` };
  }
  if (path === "/login" || path.startsWith("/auth/dos-pasos")) return { redirect: "/" };
  return null;
}
```

Ajusta los detalles para que la tabla del Step 1 pase entera. Con la tabla manda el test, no este código.

- `proxy.ts` de `packages/api`: tras `getUser()`, si hay usuario, calcula `step` con `getMfaStep(supabase)`.
- `proxy.ts` de las dos apps: sustituyen su lógica por `nextRoute()`. Construyen la redirección con `request.nextUrl.clone()`, `pathname` y `search`, y **copian las cookies** de `response` a la redirección, para no perder una sesión renovada. Las dos apps quedan con el mismo proxy.

Run: `pnpm --filter @clinicalumia/api test && make typecheck` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/api apps/admin/proxy.ts apps/dashboard/proxy.ts
git commit -m "Llevar a cada sesión a su paso de verificación desde el proxy"
```

---

### Task 4: Pantallas para activar el segundo paso y para pedir el código

**Files:**
- Modify: `packages/api/mfa.ts`, `packages/api/mfa.test.ts`
- Create:
  - en `packages/ui/src/components/`: `two-factor-setup.tsx`, `two-factor-challenge.tsx` y sus tests;
  - en cada app (`apps/dashboard/app/auth/dos-pasos/` y `apps/admin/app/auth/dos-pasos/`): `page.tsx`, `actions.ts`, `activar/page.tsx`.
- Modify: `apps/{admin,dashboard}/app/login/actions.ts`

**Interfaces:**
- Consumes: `getMfaStep`, `safeNext` (Tarea 3).
- Produces:
  - `parseTotpCode(input: string): string | null`: quita espacios y exige 6 dígitos.
  - `startTotpEnrollment(supabase): Promise<{ factorId: string; qrCode: string; secret: string } | { error: string }>`: antes de `mfa.enroll({ factorType: "totp", friendlyName: "App de autenticación" })`, da de baja con `mfa.unenroll` los factores TOTP **no verificados** del usuario (Review Focus 4).
  - `confirmTotpEnrollment(supabase, factorId, code)` y `verifyTotp(supabase, code)`, que devuelven `{ ok: true } | { error: string }`. Usan `mfa.challengeAndVerify`; `verifyTotp` busca el factor verificado con `mfa.listFactors()`.
  - Componentes:
    - `TwoFactorSetup({ qrCode, secret, factorId, action })` con `data-testid`: `totp-qr`, `totp-secret`, `totp-code`, `totp-submit`, `totp-error`;
    - `TwoFactorChallenge({ action, next })` con `totp-code`, `totp-submit`, `totp-error`, `totp-logout`.
- Mensajes:
  - "Escribe los 6 dígitos que muestra tu app."
  - "El código no es correcto o ha caducado. Prueba con el siguiente."
  - "No se ha podido preparar la verificación. Recarga la página."

- [ ] **Step 1: Tests que fallan**

- `mfa.test.ts`:
  - `parseTotpCode("123 456")` da `"123456"`; `"12345"` y `"abcdef"` dan `null`;
  - `startTotpEnrollment` da de baja los factores no verificados antes de dar de alta uno nuevo, y no toca los verificados;
  - `verifyTotp` devuelve el mensaje de código incorrecto si Supabase rechaza el código, y no lanza excepción.
- Tests de `packages/ui`:
  - la pantalla de activar enseña la clave para escribirla a mano (`totp-secret`) y el QR con `alt="Código QR para tu app de autenticación"`;
  - el campo de código tiene `inputMode="numeric"`, `autoComplete="one-time-code"` y etiqueta "Código de 6 dígitos";
  - el error se anuncia con `role="alert"`.

Run: `make test` → Expected: FAIL.

- [ ] **Step 2: Implementar**

- **Pantallas (en `packages/ui`).** Usan `AuthCard` y los componentes del sistema de diseño, con el mismo patrón `useActionState` + `onSubmit` + `startTransition` que el resto, para no perder lo escrito si hay error.
  - *Activar*: título "Protege tu cuenta" y tres pasos:
    1. "Instala una app de autenticación (Google Authenticator, Microsoft Authenticator o 1Password)."
    2. "Escanea el código QR o escribe la clave."
    3. "Escribe el código de 6 dígitos."
  - *Pedir código*: título "Verificación en dos pasos", un enlace "Salir" y la ayuda "¿Has perdido el móvil? Pide a la propietaria que restablezca tu verificación."
- **QR.** `qrCode` es lo que devuelve `mfa.enroll` en `data.totp.qr_code`. Comprueba en `node_modules/@supabase/auth-js` si ya es una URL `data:`; si no lo es, antepón `data:image/svg+xml;utf-8,`. Muéstralo con `next/image` y `unoptimized`.
- **Rutas de cada app** (dashboard y admin):
  - `auth/dos-pasos/activar/page.tsx`: servidor. Llama a `startTotpEnrollment` y pinta `TwoFactorSetup` con una acción que llama a `confirmTotpEnrollment` y, si va bien, `redirect("/")`.
  - `auth/dos-pasos/page.tsx`: pinta `TwoFactorChallenge` con una acción que llama a `verifyTotp` y, si va bien, `redirect(safeNext(next))`.
  - Las acciones son finas: toda la lógica está en `packages/api/mfa.ts`.
- **`login/actions.ts`** (las dos apps): tras la contraseña, `redirect("/")`; el proxy lleva al paso que toque.

Run: `make lint && make typecheck && make test` → Expected: PASS.

- [ ] **Step 3: Commits**

```bash
git add packages/api
git commit -m "Activar y verificar el segundo paso con la app de autenticación"
git add packages/ui
git commit -m "Añadir las pantallas de verificación en dos pasos al sistema de diseño"
git add apps
git commit -m "Pedir el segundo paso al entrar en el admin y en el dashboard"
```

---

### Task 5: Login común de los e2e con el segundo paso

**Files:**
- Create: `e2e/auth.ts`
- Modify: `e2e/package.json` (`otpauth` como devDependency), todos los `e2e/*.spec.ts` que inician sesión

**Interfaces:**
- Produces:
  - `DEV_TOTP_SECRET` en `e2e/auth.ts`.
  - `totpCode(secret: string): string`.
  - `signIn(page, baseUrl, email, password = "lumia-desarrollo-2026")`. Hace el login y después:
    - si llega a `/auth/dos-pasos`, escribe el código de `DEV_TOTP_SECRET`;
    - si llega a `/auth/dos-pasos/activar`, lee `totp-secret` de la página, escribe su código y devuelve la clave, por si el test la necesita.
  - Termina esperando a que la URL salga de `/auth/` y de `/login`.

- [ ] **Step 1: Sustituir los logins en línea**

Todos los specs que hoy rellenan email y contraseña pasan a usar `signIn`. Las cuentas que crean los tests no tienen factor, así que activan el suyo en el propio `signIn`. Algunos specs comprueban a propósito el formulario de login con errores; esos lo siguen haciendo a mano.

- [ ] **Step 2: Evitar códigos repetidos**

Si un test verifica dos veces con la misma clave dentro de la misma ventana de 30 s, Supabase rechaza el código repetido. En ese caso, `signIn` espera a la ventana siguiente antes de escribirlo. Añade un test que lo pruebe: dos `signIn` seguidos de la misma cuenta, en contextos distintos, terminan dentro.

Run: `make test.e2e` dos veces con los workers por defecto → Expected: PASS las dos.

- [ ] **Step 3: Commit**

```bash
git add e2e pnpm-lock.yaml
git commit -m "Iniciar sesión en los e2e con el segundo paso"
```

---

### Task 6: Recorridos completos y recuperación de contraseña

**Files:**
- Modify: `apps/dashboard/app/auth/confirm/route.ts`, `e2e/invite.spec.ts`
- Create: `e2e/two-factor.spec.ts`

**Interfaces:**
- Consumes: `signIn`, `totpCode` (Tarea 5), `nextRoute` (Tarea 3), `latestLinkFor` de `e2e/mail.ts`.

- [ ] **Step 1: e2e que fallan**

- **`invite.spec.ts`** (spec 4.7): la propietaria invita, el enlace del email lleva a fijar la contraseña, y después a activar el segundo paso. El test lee la clave de `totp-secret`, escribe el código y llega al dashboard.
- **`two-factor.spec.ts`:**
  - *Código incorrecto:* con la contraseña bien y el código `000000`, se ve el error y no se entra.
  - *Recuperación con el factor ya activo* (Review Focus 1): se pide un enlace desde "¿Has olvidado tu contraseña?" y se abre. La app pide el código **antes** de la pantalla de nueva contraseña. Con el código, se fija la contraseña y se entra con ella. Al terminar, el test restaura la contraseña de desarrollo con el cliente de servicio.
  - *Redirección abierta* (Review Focus 3): con `/auth/dos-pasos?next=//evil.com` y un código correcto se termina en `/` de la misma app.
  - *Sin segundo paso, sin datos* (Review Focus 2): con una sesión que solo ha pasado la contraseña, una consulta directa a la REST de Supabase con el token de esa sesión devuelve 0 especialidades.

- [ ] **Step 2: Implementar**

`auth/confirm/route.ts`: tras `verifyOtp`, redirige a `/auth/contrasena` como ahora. El proxy intercepta y, si la cuenta ya tiene factor, pasa antes por `/auth/dos-pasos?next=/auth/contrasena`. Si el test demuestra que la redirección intermedia pierde el `next`, corrígelo aquí con `nextRoute`/`safeNext`.

Run: `make test.e2e` dos veces con los workers por defecto → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard e2e
git commit -m "Probar la invitación, la recuperación y los códigos del segundo paso de principio a fin"
```

---

### Task 7: La propietaria restablece el segundo paso de un empleado

**Files:**
- Modify: `apps/admin/app/(admin)/team/actions.ts`, `team/actions.test.ts`, `team/MemberRow.tsx`, `e2e/admin-ui.spec.ts`

**Interfaces:**
- Produces:
  - `resetTwoFactor(memberId: string): Promise<ActionResult>`. Empieza con `requireOwner`. Rechaza con "No puedes restablecer tu propia verificación desde aquí." si `memberId` es el de la propietaria. Con `createAdminClient()`, lista los factores del usuario (`auth.admin.mfa.listFactors({ userId })`) y los borra (`auth.admin.mfa.deleteFactor({ id, userId })`).
  - En `MemberRow`, solo para empleados: botón "Restablecer verificación" (`data-testid="member-reset-2fa"`) con `ConfirmDialog`: "¿Restablecer la verificación en dos pasos? La próxima vez que entre tendrá que activarla de nuevo."

- [ ] **Step 1: Tests que fallan**

- Unitarios:
  - quien no es propietaria recibe el error de permiso y no se borra nada;
  - la propietaria no puede restablecer la suya;
  - si falla el borrado, se devuelve "No se ha podido restablecer la verificación.";
  - si todo va bien, se borran todos los factores del empleado.
- e2e: restablecer a "Laura Ejemplo" deja su cuenta sin factor, y su siguiente login pide activarlo. Después, el test la restaura con su factor de desarrollo usando el cliente de servicio, o hace `make db.reset` en `afterAll` si no hay otra forma limpia; explica cuál en el informe.

- [ ] **Step 2: Implementar, verificar y commit**

Run: `make lint && make typecheck && make test && make test.e2e` → Expected: PASS.

```bash
git add "apps/admin/app/(admin)/team" e2e/admin-ui.spec.ts
git commit -m "Permitir a la propietaria restablecer el segundo paso de un empleado"
```

---

### Task 8: Emails de login por Resend y la invitación de la propietaria

**Files:**
- Modify: `packages/db/supabase/config.toml`, `Makefile`, `packages/db/package.json`, `packages/db/.env.example`
- Create: `packages/db/scripts/invite-owner.ts`, `packages/db/scripts/invite-owner.test.ts`

**Interfaces:**
- Produces:
  - SMTP de Resend en `[remotes.dev.auth.email.smtp]` y `[remotes.prod.auth.email.smtp]`:
    - `enabled = true`, `host = "smtp.resend.com"`, `port = 465`, `user = "resend"`;
    - `pass = "env(RESEND_API_KEY)"`;
    - `admin_email = "no-responder@clinicalumia.es"`, `sender_name = "Clínica LUMIA"`.

    En local sigue Mailpit.
  - `db.config.dev` y `db.config.prod` exportan `RESEND_API_KEY` desde su `.env.*` sin imprimirla, y fallan con un mensaje claro si falta.
  - `inviteOwner(supabase, { email, fullName, redirectTo })`:
    - invita con `auth.admin.inviteUserByEmail(email, { redirectTo })`;
    - crea su perfil `owner`, activo, con el nombre;
    - si ya existe un perfil con ese email, no hace nada y lo dice;
    - si falla el perfil, borra el usuario invitado.
  - `make db.owner.prod email=… name="…"`:
    - pide escribir `produccion`;
    - lee `NEXT_PUBLIC_SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` de `packages/db/.env.prod` sin imprimirlos;
    - invita con `redirectTo=https://panel.clinicalumia.es/auth/confirm`.
  - `make db.owner.local` hace lo mismo contra Supabase local, sin confirmación, para probarlo con Mailpit.

- [ ] **Step 1: Tests que fallan**

`invite-owner.test.ts`, con un cliente simulado:
- invita y crea el perfil con `role: "owner"`;
- con el perfil ya existente, no invita;
- si el perfil falla, borra el usuario y devuelve el error.

- [ ] **Step 2: Implementar y comprobar en local**

Run: `make test`, luego `make db.owner.local email=nueva-duena@lumia.test name="Dueña de prueba"`. El email aparece en Mailpit con el enlace a `/auth/confirm`. Después, borra ese usuario con el cliente de servicio o con `make db.reset`.

No ejecutes `db.config.*` ni `db.owner.prod`: son de la Parte B.

- [ ] **Step 3: Commit**

```bash
git add packages/db Makefile
git commit -m "Enviar los emails de acceso por Resend e invitar a la propietaria en producción"
```

---

# Parte B — Publicación (controlador, con confirmación del usuario en cada paso)

Cada paso dice qué se hace, qué comprueba el controlador y qué necesita del usuario. **Nada remoto se ejecuta sin un "sí" explícito en el chat para ese paso.** Los secretos no se muestran nunca.

### B0 · Requisitos del usuario (antes de empezar)

1. **Vercel.**
   - Qué: pasar el equipo `patricias-projects-5b52d652` a **Pro** y añadir la cuenta de Vicent como miembro.
   - Por qué: Hobby no permite uso comercial y bloquea los despliegues de commits de otros autores (spec 4.6).
   - Mientras no esté en Pro: los proyectos nuevos se publican con `vercel deploy --prod` desde la terminal, como la web hoy.
2. **Resend.** Dominio `clinicalumia.es` verificado (los registros DNS que da Resend).
3. **Supabase.**
   - Producción en plan **Pro**: copias diarias y sin pausas.
   - La región sigue en Londres por decisión vuestra. Se revisa antes de guardar datos de pacientes (pieza 2); en esta pieza solo hay datos de la clínica y del equipo.
4. **GitHub.** `git push origin main` (lo ejecuta el usuario con `! git push origin main`).

### B1 · Secretos locales de producción

1. Crear `packages/db/.env.prod` con `vercel env pull --environment=production` desde `clinicalumia-web`, que tiene la base de producción conectada a Production. Pide confirmación antes del `pull`.
2. Añadir `DATABASE_URL` (la `POSTGRES_URL_NON_POOLING`), `SUPABASE_PROJECT_REF` y `RESEND_API_KEY`, sin imprimir nada.
3. Añadir `RESEND_API_KEY` a `.env.dev` igual.
4. Comprobar solo que las claves existen, con `grep -c`, nunca con su valor.

### B2 · Base de datos de desarrollo (`lumia-db-dev`)

1. `make db.status`: listar lo que falta en dev (migraciones de 1c y 1d).
2. **Confirmación.** `make db.push.dev`, y después `make db.status` para comprobar que dev está al día.
3. **Confirmación.** `make db.config.dev`: TOTP, plantillas en español y SMTP de Resend. `supabase config push` enseña el diff antes de aplicarlo.

### B3 · Proyectos de Vercel

1. **Confirmación.** Crear `clinicalumia-dashboard` (carpeta `apps/dashboard`) y `clinicalumia-admin` (carpeta `apps/admin`) en el mismo equipo que `clinicalumia-web`: framework Next.js e instalación con pnpm desde la raíz del monorepo.
2. **Usuario, en la web de Vercel.** Conectar los stores de Supabase a cada proyecto: producción a Production, y `lumia-db-dev` a Preview y Development, igual que en `clinicalumia-web`.
   - El controlador comprueba después los **nombres** de las variables con `vercel env ls`, previa confirmación: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y `SUPABASE_SERVICE_ROLE_KEY` solo en admin.
   - Si la integración inyecta la clave de servicio también en el dashboard, se deja constancia: el dashboard no la lee.
3. **Confirmación.** Dominios:
   - `panel.clinicalumia.es` → `clinicalumia-dashboard`;
   - `admin.clinicalumia.es` → `clinicalumia-admin`.

   Si el DNS de `clinicalumia.es` no está en Vercel, el controlador dice qué registro CNAME crear y dónde.
4. **Confirmación.** Primer despliegue de cada proyecto (`vercel deploy --prod` si el equipo sigue en Hobby). Comprobar que las dos URL responden con la pantalla de login.

### B4 · Base de datos de producción

1. `make db.status`: prod debe tener pendientes exactamente las mismas migraciones que dev ya tiene.
2. **Confirmación.** `make db.push.prod` (la propia orden pide escribir `produccion`).
3. **Confirmación.** `make db.config.prod`: `site_url` `https://panel.clinicalumia.es`, redirecciones de panel y admin, TOTP, plantillas y SMTP.
4. **Confirmación.** `make db.owner.prod email=info@clinicalumia.es name="Patricia Hernán Sánchez"`.

### B5 · Primera entrada de la propietaria y humo

1. Patricia abre el email, fija su contraseña en `panel.clinicalumia.es`, activa el segundo paso con su móvil y entra.
2. Entra en `admin.clinicalumia.es`; como es otra web, pide contraseña y código otra vez.
3. Rellena "Datos de la clínica". Crea los servicios reales e invita al equipo.
4. El controlador revisa con ella que:
   - el email de invitación llega desde `clinicalumia.es`;
   - el enlace lleva a `panel.`;
   - un código incorrecto se rechaza.
5. **Procedimiento si Patricia pierde el móvil** (solo ella; a los empleados los restablece Patricia desde Equipo): desde Supabase, en Authentication → Users → su usuario → borrar el factor. Al volver a entrar lo activa de nuevo. Se documenta en `specs/operacion.md`, que el controlador crea en un commit.

---

## Siguiente

Pieza 2 (agenda) según la spec. Antes de guardar datos de pacientes en producción hay que revisar la región de Supabase y los contratos RGPD (spec, sección 6).
