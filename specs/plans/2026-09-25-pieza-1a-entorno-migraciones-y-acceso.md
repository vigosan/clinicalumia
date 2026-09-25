# Pieza 1a — Entorno, migraciones y acceso · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el monorepo listo para desarrollar con seguridad: un Makefile que lo hace todo, migraciones sincronizadas entre local, dev y prod, permisos de base de datos probados, tipos generados, acciones del admin seguras y que muestran sus errores, e invitaciones y contraseñas que funcionan.

**Architecture:** Supabase local en Docker Desktop para desarrollar y ejecutar tests; `lumia-db-dev` y producción en la nube, alcanzadas solo con migraciones versionadas y un guardián que impide que producción vaya por delante de dev. La configuración de login vive en `packages/db/supabase/config.toml`, con un bloque `[remotes.*]` por entorno. El flujo de invitación y recuperación vive en el dashboard.

**Tech Stack:** pnpm 10 + Turborepo · Next.js 16 · Supabase CLI 2.116+ · Postgres + pgTAP · Vitest · Playwright · Biome.

**Spec:** `specs/2026-09-25-plataforma-lumia-v1-design.md` (secciones 2, 4.1, 4.2 puntos 1–2, 4.3 salvo la verificación en dos pasos, 4.7).

**Planes hermanos:** 1b (sistema de diseño `packages/ui`) y 1c (configuración del admin, publicación y verificación en dos pasos) se escriben al cerrar este.

## Global Constraints

- Todo cambio de base de datos es una migración en `packages/db/supabase/migrations`; nunca cambios manuales en el panel de Supabase.
- Producción nunca recibe una migración que no esté ya aplicada en dev.
- Roles: `owner` (Propietaria) y `employee` (Empleado).
- Ningún permiso de fila se concede por "haber iniciado sesión" sin más: hace falta perfil activo (`is_active_staff()`), y escritura de configuración solo `owner`.
- Registro abierto desactivado: solo se entra por invitación.
- Commits pequeños: un cambio por commit, título descriptivo en español, sin cuerpo ni prefijos (`feat:`…), compilando y con los tests en verde. Nunca `--no-verify`.
- Sin comentarios en el código. Selectores de test: `data-testid` primero.
- Cada tarea en su worktree o rama; `make lint`, `make typecheck` y `make test` en verde antes de cada commit.

## Review Focus

1. **Enlace de invitación caducado o ya usado**: debe llevar al login con un mensaje comprensible, nunca a un error 500 ni a una sesión a medias. Test en la Tarea 8.
2. **Base de datos de producción sin tabla de migraciones** (primer despliegue): el estado debe tratarla como "ninguna aplicada", no fallar. Test en la Tarea 2.
3. **Empleado desactivado con sesión abierta**: no debe leer nada aunque su token siga siendo válido. Test en la Tarea 4.
4. **Acción del admin invocada directamente por un empleado** (sin pasar por el layout): debe rechazarse antes de usar la clave de servicio. Test en la Tarea 6.
5. **Contraseñas que no coinciden o demasiado cortas**: error claro sin perder lo escrito. Test en la Tarea 8.

---

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `Makefile` | Punto de entrada único de desarrollo (modificar). |
| `scripts/doctor.sh` | Comprueba herramientas necesarias (crear). |
| `scripts/local-env.sh` | Escribe `apps/*/.env.development.local` con las claves del Supabase local (crear). |
| `packages/db/scripts/migrations.ts` | Lógica pura de estado y promoción de migraciones (crear). |
| `packages/db/scripts/migrations.test.ts` | Tests de lo anterior (crear). |
| `packages/db/scripts/migrations-cli.ts` | CLI que consulta dev y prod e imprime estado o bloqueos (crear). |
| `packages/db/.env.example` | Variables de cada entorno remoto (crear). |
| `packages/db/supabase/config.toml` | Registro desactivado, plantillas en español, bloques `[remotes.dev]` y `[remotes.prod]` (modificar). |
| `packages/db/supabase/templates/invite.html`, `recovery.html` | Emails en español con enlace `token_hash` (crear). |
| `packages/db/supabase/migrations/20260925090000_roles_y_personal_activo.sql` | `doctor`→`employee`, nº de colegiado, `is_active_staff()`, permisos (crear). |
| `packages/db/supabase/tests/permissions.test.sql` | pgTAP de permisos (crear). |
| `packages/db/types.ts` | Tipos generados (crear con `make db.types`). |
| `packages/api/{server,browser,admin,proxy}.ts` | Clientes tipados con `Database` (modificar). |
| `packages/api/auth.ts` + `auth.test.ts` | `requireOwner()` (crear). |
| `apps/admin/app/(admin)/**/actions.ts`, `*Row.tsx`, `team/page.tsx` | Guardia de propietaria y errores visibles (modificar). |
| `apps/dashboard/app/auth/confirm/route.ts` | Valida el enlace del email (crear). |
| `apps/dashboard/app/auth/contrasena/*` | Fijar contraseña (crear). |
| `apps/dashboard/app/login/recuperar/*` | Pedir email de recuperación (crear). |
| `apps/dashboard/lib/password.ts` + test | Validación de contraseña (crear). |
| `e2e/` | Paquete Playwright con el test de invitación (crear). |

---

### Task 1: Makefile como punto de entrada del desarrollo local

**Files:**
- Create: `scripts/doctor.sh`, `scripts/local-env.sh`
- Modify: `Makefile`

**Interfaces:**
- Produces: `make doctor`, `make setup`, `make docker.up`, `make env.local`, `make dev.web|dev.admin|dev.dashboard`, `make db.mail`, `make test.db`. `apps/*/.env.development.local` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` del Supabase local.

- [ ] **Step 1: Escribir `scripts/doctor.sh`**

```bash
#!/usr/bin/env bash
set -u

missing=0

check() {
  local name="$1" command="$2" hint="$3"
  if eval "$command" >/dev/null 2>&1; then
    printf '  \033[32m✓\033[0m %s\n' "$name"
  else
    printf '  \033[31m✗\033[0m %s — %s\n' "$name" "$hint"
    missing=1
  fi
}

check "node >= 20" 'node -e "process.exit(Number(process.versions.node.split(\".\")[0]) >= 20 ? 0 : 1)"' "instala Node 20 o superior"
check "pnpm" "pnpm --version" "corepack enable"
check "supabase CLI" "supabase --version" "brew install supabase/tap/supabase"
check "docker" "docker --version" "instala OrbStack (brew install --cask orbstack) o Docker Desktop"
check "docker en marcha" "docker info" "abre OrbStack o Docker Desktop, o ejecuta make docker.up"

exit "$missing"
```

- [ ] **Step 2: Comprobar que detecta lo que falta**

Run: `chmod +x scripts/doctor.sh && PATH=/usr/bin:/bin bash scripts/doctor.sh; echo "exit=$?"`
Expected: líneas con `✗` para pnpm, supabase y docker, y `exit=1`.

Run: `bash scripts/doctor.sh; echo "exit=$?"` (con Docker Desktop abierto)
Expected: todas con `✓` y `exit=0`.

- [ ] **Step 3: Escribir `scripts/local-env.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../packages/db"
status="$(supabase status -o env)"

value() {
  printf '%s\n' "$status" | grep "^$1=" | cut -d= -f2- | tr -d '"'
}

url="$(value API_URL)"
anon="$(value ANON_KEY)"
service="$(value SERVICE_ROLE_KEY)"

for app in web admin dashboard; do
  file="../../apps/$app/.env.development.local"
  {
    echo "NEXT_PUBLIC_SUPABASE_URL=\"$url\""
    echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=\"$anon\""
    echo "SUPABASE_SERVICE_ROLE_KEY=\"$service\""
  } > "$file"
  echo "  escrito apps/$app/.env.development.local"
done
```

Next.js da prioridad a `.env.development.local` sobre `.env.local` en desarrollo, así que este archivo no pisa las claves que cada app ya tenga (Resend, Instagram…). Ambos están en `.gitignore` (`.env.*`).

- [ ] **Step 4: Reescribir el `Makefile`**

```makefile
SHELL := /bin/bash
.DEFAULT_GOAL := help
DB := packages/db

.PHONY: help doctor setup docker.up install env.local dev dev.web dev.admin dev.dashboard stop \
        build lint format typecheck test test.db clean \
        db.start db.stop db.reset db.migrate db.types db.studio db.mail db.bootstrap

help: ## Muestra los comandos disponibles
	@grep -hE '^[a-zA-Z_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

doctor: ## Comprueba que tienes todo lo necesario
	@bash scripts/doctor.sh

setup: install docker.up db.start env.local ## Primera vez: instala, arranca Supabase local y genera los .env
	@echo "Listo. Crea tu cuenta con: make db.bootstrap email=... password=... name=\"...\""

docker.up: ## Arranca Docker (OrbStack o Docker Desktop) y espera a que responda
	@docker info >/dev/null 2>&1 || ((open -a OrbStack 2>/dev/null || open -a Docker) && until docker info >/dev/null 2>&1; do sleep 1; done)

install: ## Instala dependencias
	pnpm install

env.local: ## Escribe apps/*/.env.development.local con las claves del Supabase local
	@bash scripts/local-env.sh

dev: db.start ## Arranca Supabase local y las tres apps
	pnpm turbo run dev

dev.web: ## Solo la web (puerto 3000)
	pnpm --filter web dev

dev.admin: db.start ## Solo el admin (puerto 3002)
	pnpm --filter admin dev

dev.dashboard: db.start ## Solo el dashboard (puerto 3001)
	pnpm --filter dashboard dev

stop: db.stop ## Para todo

build: ## Compila apps y paquetes
	pnpm turbo run build

lint: ## Lint y formato con Biome
	pnpm lint

format: ## Formatea con Biome
	pnpm format

typecheck: ## Comprueba tipos
	pnpm turbo run typecheck

test: ## Tests unitarios de todo el monorepo
	pnpm turbo run test

test.db: db.start ## Tests de permisos de base de datos (pgTAP, Supabase local)
	cd $(DB) && supabase test db

clean: ## Borra compilados y dependencias
	pnpm turbo run clean
	rm -rf node_modules

db.start: docker.up ## Arranca Supabase local
	@cd $(DB) && (supabase status >/dev/null 2>&1 || supabase start)

db.stop: ## Para Supabase local
	cd $(DB) && supabase stop

db.reset: ## Reinicia la base local y aplica migraciones y seed
	cd $(DB) && supabase db reset

db.migrate: ## Crea una migración: make db.migrate name=add_patients
	@if [ -z "$(name)" ]; then echo "Uso: make db.migrate name=<nombre>"; exit 1; fi
	cd $(DB) && supabase migration new $(name)

db.types: ## Genera packages/db/types.ts desde la base local
	cd $(DB) && supabase gen types typescript --local > types.ts

db.studio: ## Abre Supabase Studio local
	open http://localhost:54323

db.mail: ## Abre el buzón local donde llegan los emails (invitaciones, recuperación)
	open http://localhost:54324

db.bootstrap: ## Crea la propietaria en local: make db.bootstrap email=... password=... name="..."
	@if [ -z "$(email)" ] || [ -z "$(password)" ] || [ -z "$(name)" ]; then \
		echo 'Uso: make db.bootstrap email=user@example.com password=secret name="Dra. Patricia"'; exit 1; \
	fi
	cd $(DB) && \
		SUPABASE_URL=http://127.0.0.1:54321 \
		SUPABASE_SERVICE_ROLE_KEY=$$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"') \
		OWNER_EMAIL="$(email)" OWNER_PASSWORD="$(password)" OWNER_FULL_NAME="$(name)" \
		pnpm bootstrap:owner
```

- [ ] **Step 5: Verificar de extremo a extremo**

Run: `make help`
Expected: lista con `doctor`, `setup`, `dev.dashboard`, `test.db`, `db.mail`… cada uno con su descripción.

Run: `make setup`
Expected: termina con "Listo." y existen `apps/{web,admin,dashboard}/.env.development.local` con las tres variables.

Run: `make test.db`
Expected: "No tests found" o equivalente sin error de conexión (aún no hay tests).

- [ ] **Step 6: Commit**

```bash
git add Makefile scripts/doctor.sh scripts/local-env.sh
git commit -m "Centralizar el desarrollo local en el Makefile con Supabase en Docker"
```

---

### Task 2: Estado y promoción de migraciones entre dev y prod

**Files:**
- Create: `packages/db/scripts/migrations.ts`, `packages/db/scripts/migrations.test.ts`, `packages/db/scripts/migrations-cli.ts`, `packages/db/.env.example`, `packages/db/vitest.config.ts`
- Modify: `packages/db/package.json`, `Makefile`

**Interfaces:**
- Produces:
  - `localVersions(fileNames: string[]): string[]`
  - `migrationStatus(local: string[], dev: string[], prod: string[]): MigrationRow[]` con `type MigrationRow = { version: string; dev: boolean; prod: boolean }`
  - `promotionBlockers(local: string[], dev: string[], prod: string[]): string[]`
  - Targets `make db.status`, `make db.push.dev`, `make db.push.prod`.
  - `packages/db/.env.dev` y `.env.prod` (no versionados) con `DATABASE_URL`, `SUPABASE_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SITE_URL`.

- [ ] **Step 1: Añadir dependencias y script de test**

Run: `pnpm --filter @clinicalumia/db add postgres && pnpm --filter @clinicalumia/db add -D vitest`

Edita `packages/db/package.json` → `scripts`:

```json
"test": "vitest run",
"migrations": "tsx scripts/migrations-cli.ts"
```

Crea `packages/db/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["scripts/**/*.test.ts"] },
});
```

- [ ] **Step 2: Escribir los tests que fallan**

`packages/db/scripts/migrations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  localVersions,
  migrationStatus,
  promotionBlockers,
} from "./migrations";

describe("localVersions", () => {
  it("reads the timestamp of each migration file in order, ignoring anything else", () => {
    expect(
      localVersions([
        "20260925090000_roles.sql",
        "README.md",
        "20260501062643_init_schema.sql",
      ]),
    ).toEqual(["20260501062643", "20260925090000"]);
  });
});

describe("migrationStatus", () => {
  it("shows per migration whether each database has it, so drift is visible at a glance", () => {
    expect(
      migrationStatus(["1", "2"], ["1", "2"], ["1"]),
    ).toEqual([
      { version: "1", dev: true, prod: true },
      { version: "2", dev: true, prod: false },
    ]);
  });

  it("treats a database that never ran migrations as having none", () => {
    expect(migrationStatus(["1"], [], [])).toEqual([
      { version: "1", dev: false, prod: false },
    ]);
  });
});

describe("promotionBlockers", () => {
  it("allows promoting when everything pending in prod is already applied in dev", () => {
    expect(promotionBlockers(["1", "2"], ["1", "2"], ["1"])).toEqual([]);
  });

  it("blocks a migration that dev has not run yet, so prod never gets untested changes", () => {
    expect(promotionBlockers(["1", "2"], ["1"], ["1"])).toEqual(["2"]);
  });

  it("blocks when prod has a migration missing from the repo, because the schemas have drifted", () => {
    expect(promotionBlockers(["1"], ["1"], ["1", "9"])).toEqual(["9"]);
  });
});
```

- [ ] **Step 3: Ejecutar y ver el fallo**

Run: `pnpm --filter @clinicalumia/db test`
Expected: FAIL — `Cannot find module './migrations'`.

- [ ] **Step 4: Implementar `packages/db/scripts/migrations.ts`**

```ts
export type MigrationRow = { version: string; dev: boolean; prod: boolean };

export function localVersions(fileNames: string[]): string[] {
  return fileNames
    .map((name) => /^(\d{14})_.+\.sql$/.exec(name)?.[1])
    .filter((version): version is string => Boolean(version))
    .sort();
}

export function migrationStatus(
  local: string[],
  dev: string[],
  prod: string[],
): MigrationRow[] {
  return local.map((version) => ({
    version,
    dev: dev.includes(version),
    prod: prod.includes(version),
  }));
}

export function promotionBlockers(
  local: string[],
  dev: string[],
  prod: string[],
): string[] {
  const untested = local.filter(
    (version) => !prod.includes(version) && !dev.includes(version),
  );
  const unknown = prod.filter((version) => !local.includes(version));
  return [...untested, ...unknown].sort();
}
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `pnpm --filter @clinicalumia/db test`
Expected: PASS, 6 tests.

- [ ] **Step 6: Escribir la CLI `packages/db/scripts/migrations-cli.ts`**

```ts
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";
import {
  localVersions,
  migrationStatus,
  promotionBlockers,
} from "./migrations";

async function appliedVersions(url: string | undefined): Promise<string[]> {
  if (!url) throw new Error("Falta DATABASE_URL de uno de los entornos.");
  const sql = postgres(url, { max: 1, prepare: false });
  try {
    const rows = await sql<{ version: string }[]>`
      select version from supabase_migrations.schema_migrations`;
    return rows.map((row) => row.version);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01" || code === "3F000") return [];
    throw error;
  } finally {
    await sql.end();
  }
}

async function main() {
  const command = process.argv[2];
  const local = localVersions(
    readdirSync(resolve(import.meta.dirname, "../supabase/migrations")),
  );
  const [dev, prod] = await Promise.all([
    appliedVersions(process.env.DEV_DATABASE_URL),
    appliedVersions(process.env.PROD_DATABASE_URL),
  ]);

  if (command === "status") {
    console.table(
      migrationStatus(local, dev, prod).map((row) => ({
        migración: row.version,
        dev: row.dev ? "✓" : "pendiente",
        prod: row.prod ? "✓" : "pendiente",
      })),
    );
    return;
  }

  if (command === "check-promotable") {
    const blockers = promotionBlockers(local, dev, prod);
    if (blockers.length > 0) {
      console.error(
        `No se puede pasar a producción. Aplica antes en dev o revisa: ${blockers.join(", ")}`,
      );
      process.exit(1);
    }
    console.log("Todo lo pendiente en producción ya está aplicado en dev.");
    return;
  }

  console.error("Uso: migrations <status|check-promotable>");
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

- [ ] **Step 7: Documentar `packages/db/.env.example`**

```bash
# Copia este archivo como .env.dev (lumia-db-dev) y como .env.prod (producción).
# Ambos están fuera de git. Valores en Supabase → Project Settings.
# DATABASE_URL: "Session pooler" (IPv4), con la contraseña codificada para URL.
DATABASE_URL=""
SUPABASE_PROJECT_REF=""
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
# URL pública del dashboard en ese entorno (enlaces de los emails).
SITE_URL=""
```

- [ ] **Step 8: Añadir los targets al `Makefile`**

Añade a `.PHONY`: `db.status db.push.dev db.push.prod`, y al final:

```makefile
DEV_ENV := $(DB)/.env.dev
PROD_ENV := $(DB)/.env.prod
env_of = $(shell grep '^$(2)=' $(1) 2>/dev/null | cut -d= -f2- | tr -d '"')

db.status: ## Qué migraciones tiene aplicadas dev y cuáles prod
	@DEV_DATABASE_URL="$(call env_of,$(DEV_ENV),DATABASE_URL)" \
	 PROD_DATABASE_URL="$(call env_of,$(PROD_ENV),DATABASE_URL)" \
	 pnpm --silent --filter @clinicalumia/db migrations status

db.push.dev: ## Aplica en lumia-db-dev las migraciones pendientes
	cd $(DB) && supabase db push --db-url "$(call env_of,$(DEV_ENV),DATABASE_URL)"

db.push.prod: ## Aplica en producción (solo si dev ya las tiene; pide confirmación)
	@DEV_DATABASE_URL="$(call env_of,$(DEV_ENV),DATABASE_URL)" \
	 PROD_DATABASE_URL="$(call env_of,$(PROD_ENV),DATABASE_URL)" \
	 pnpm --silent --filter @clinicalumia/db migrations check-promotable
	@read -p "¿Aplicar las migraciones pendientes en PRODUCCIÓN? Escribe 'produccion': " answer; \
	 [ "$$answer" = "produccion" ] || (echo "Cancelado."; exit 1)
	cd $(DB) && supabase db push --db-url "$(call env_of,$(PROD_ENV),DATABASE_URL)"
```

- [ ] **Step 9: Verificar**

Run: `make lint && make test`
Expected: sin errores; los 6 tests de migraciones pasan.

Run (sin `.env.dev`): `make db.status`
Expected: "Falta DATABASE_URL de uno de los entornos." y código de salida 1.

- [ ] **Step 10: Commit**

```bash
git add packages/db Makefile pnpm-lock.yaml
git commit -m "Ver y promover migraciones entre dev y producción sin saltarse dev"
```

---

### Task 3: Configuración de acceso versionada por entorno

**Files:**
- Modify: `packages/db/supabase/config.toml`, `Makefile`
- Create: `packages/db/supabase/templates/invite.html`, `packages/db/supabase/templates/recovery.html`

**Interfaces:**
- Consumes: `packages/db/.env.dev|.env.prod` (`SUPABASE_PROJECT_REF`, `SITE_URL`) de la Tarea 2.
- Produces: `make db.config.dev`, `make db.config.prod`. Emails que enlazan a `{{ .SiteURL }}/auth/confirm?token_hash=…&type=invite|recovery` (Tarea 8).

- [ ] **Step 1: Desactivar el registro abierto en `config.toml`**

En `[auth]` cambia `enable_signup = true` por `enable_signup = false`. En `[auth.email]` cambia `enable_signup = true` por `enable_signup = false`.

- [ ] **Step 2: Plantillas en español**

`packages/db/supabase/templates/invite.html`:

```html
<h2>Te han invitado a LUMIA</h2>
<p>Pulsa el enlace para crear tu contraseña y entrar en el panel de la clínica.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">Crear mi contraseña</a></p>
<p>Si no esperabas esta invitación, ignora este email.</p>
```

`packages/db/supabase/templates/recovery.html`:

```html
<h2>Cambiar tu contraseña de LUMIA</h2>
<p>Pulsa el enlace para elegir una contraseña nueva. Caduca en una hora.</p>
<p><a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Elegir contraseña nueva</a></p>
<p>Si no lo has pedido tú, ignora este email: tu contraseña no cambia.</p>
```

En `config.toml`, sustituye los bloques comentados `# [auth.email.template.invite]` por:

```toml
[auth.email.template.invite]
subject = "Te han invitado a LUMIA"
content_path = "./supabase/templates/invite.html"

[auth.email.template.recovery]
subject = "Cambiar tu contraseña de LUMIA"
content_path = "./supabase/templates/recovery.html"
```

- [ ] **Step 3: Bloques por entorno**

Pide a la persona responsable el *project ref* de `lumia-db-dev` y de producción (Supabase → Project Settings → General; son 20 letras minúsculas, no son secretos) y la URL pública del dashboard de cada uno. Añade al final de `config.toml` con esos valores reales:

```toml
[remotes.dev]
project_id = "<ref de lumia-db-dev>"

[remotes.dev.auth]
site_url = "<SITE_URL de dev>"
additional_redirect_urls = ["<SITE_URL de dev>"]

[remotes.prod]
project_id = "<ref de producción>"

[remotes.prod.auth]
site_url = "https://panel.clinicalumia.es"
additional_redirect_urls = ["https://panel.clinicalumia.es", "https://admin.clinicalumia.es"]
```

Si aún no hay dominio de dev, usa la URL de preview de Vercel del dashboard cuando exista (plan 1c) y deja de momento solo el bloque de prod con su ref.

- [ ] **Step 4: Targets en el `Makefile`**

Añade a `.PHONY`: `db.config.dev db.config.prod`, y:

```makefile
db.config.dev: ## Aplica la configuración de login (config.toml) a lumia-db-dev
	cd $(DB) && supabase config push --project-ref "$(call env_of,$(DEV_ENV),SUPABASE_PROJECT_REF)"

db.config.prod: ## Aplica la configuración de login a producción (pide confirmación)
	@read -p "¿Aplicar config.toml en PRODUCCIÓN? Escribe 'produccion': " answer; \
	 [ "$$answer" = "produccion" ] || (echo "Cancelado."; exit 1)
	cd $(DB) && supabase config push --project-ref "$(call env_of,$(PROD_ENV),SUPABASE_PROJECT_REF)"
```

- [ ] **Step 5: Verificar en local**

Run: `make db.stop && make db.start`
Expected: arranca sin errores de configuración.

Run: `curl -s -X POST http://127.0.0.1:54321/auth/v1/signup -H "apikey: $(grep ANON_KEY apps/dashboard/.env.development.local | cut -d'"' -f2)" -H 'content-type: application/json' -d '{"email":"x@example.com","password":"supersecreta123"}'`
Expected: respuesta con `"Signups not allowed for this instance"` (o `signup_disabled`).

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase Makefile
git commit -m "Versionar la configuración de acceso y cerrar el registro abierto"
```

---

### Task 4: Permisos que exigen personal activo y rol `employee`

**Files:**
- Create: `packages/db/supabase/tests/permissions.test.sql`, `packages/db/supabase/migrations/20260925090000_roles_y_personal_activo.sql`
- Modify: `apps/admin/app/(admin)/team/actions.ts`, `apps/admin/app/(admin)/team/page.tsx`

**Interfaces:**
- Produces (SQL): enum `user_role` = `owner | employee`; columna `profiles.license_number text null`; `public.is_active_staff() returns boolean`; `public.is_owner()` ahora exige `is_active`.

- [ ] **Step 1: Escribir el test pgTAP que falla**

`packages/db/supabase/tests/permissions.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'owner@test.local'),
  ('00000000-0000-0000-0000-000000000002', 'employee@test.local'),
  ('00000000-0000-0000-0000-000000000003', 'inactive@test.local'),
  ('00000000-0000-0000-0000-000000000004', 'nobody@test.local');

insert into public.profiles (id, email, full_name, role, is_active) values
  ('00000000-0000-0000-0000-000000000001', 'owner@test.local', 'Owner', 'owner', true),
  ('00000000-0000-0000-0000-000000000002', 'employee@test.local', 'Employee', 'employee', true),
  ('00000000-0000-0000-0000-000000000003', 'inactive@test.local', 'Inactive', 'employee', false);

insert into public.specialties (name, slug) values ('Prueba', 'prueba');

create or replace function pg_temp.act_as(user_id uuid) returns void language sql as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
$$;

select pg_temp.act_as('00000000-0000-0000-0000-000000000004');
select is((select count(*) from public.specialties where slug = 'prueba'), 0::bigint,
  'someone signed in without a profile sees no clinic data');

select pg_temp.act_as('00000000-0000-0000-0000-000000000003');
select is((select count(*) from public.specialties where slug = 'prueba'), 0::bigint,
  'a deactivated employee with a valid token sees nothing');

select pg_temp.act_as('00000000-0000-0000-0000-000000000002');
select is((select count(*) from public.specialties where slug = 'prueba'), 1::bigint,
  'an active employee can read clinic configuration');
select throws_ok($$ insert into public.specialties (name, slug) values ('X', 'x') $$, '42501', null,
  'an employee cannot change clinic configuration');

select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into public.specialties (name, slug) values ('Y', 'y') $$,
  'the active owner can change clinic configuration');

reset role;
update public.profiles set is_active = false where id = '00000000-0000-0000-0000-000000000001';
select pg_temp.act_as('00000000-0000-0000-0000-000000000001');
select throws_ok($$ insert into public.specialties (name, slug) values ('Z', 'z') $$, '42501', null,
  'a deactivated owner loses write access');

reset role;
select is((select column_default from information_schema.columns
           where table_name = 'profiles' and column_name = 'role'), '''employee''::user_role',
  'new team members default to employee');

select * from finish();
rollback;
```

- [ ] **Step 2: Ejecutar y ver el fallo**

Run: `make db.reset && make test.db`
Expected: FAIL — el insert de perfiles falla con `invalid input value for enum user_role: "employee"`.

- [ ] **Step 3: Escribir la migración**

`packages/db/supabase/migrations/20260925090000_roles_y_personal_activo.sql`:

```sql
alter type public.user_role rename value 'doctor' to 'employee';
alter table public.profiles alter column role set default 'employee';
alter table public.profiles add column license_number text;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
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
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner' and is_active
  );
$$;

drop policy "specialties_select_authenticated" on public.specialties;

create policy "specialties_select_active_staff"
  on public.specialties for select
  to authenticated
  using (public.is_active_staff());
```

- [ ] **Step 4: Ejecutar y ver que pasa**

Run: `make db.reset && make test.db`
Expected: PASS, `ok 1..7`.

- [ ] **Step 5: Adaptar el admin al rol renombrado**

En `apps/admin/app/(admin)/team/actions.ts` cambia `role: "doctor",` por `role: "employee",`.
En `apps/admin/app/(admin)/team/page.tsx` cambia `.eq("role", "doctor")` por `.eq("role", "employee")`.

Run: `grep -rn '"doctor"' apps packages --include=*.ts --include=*.tsx | grep -v node_modules`
Expected: sin resultados.

- [ ] **Step 6: Commit**

```bash
git add packages/db/supabase apps/admin
git commit -m "Exigir personal activo para leer datos de la clínica y renombrar el rol a empleado"
```

---

### Task 5: Tipos generados y clientes de Supabase tipados

**Files:**
- Create: `packages/db/types.ts` (generado)
- Modify: `packages/api/server.ts`, `packages/api/browser.ts`, `packages/api/admin.ts`, `packages/api/package.json`, `Makefile`

**Interfaces:**
- Produces: `import type { Database } from "@clinicalumia/db"`; `createClient()` y `createAdminClient()` devuelven `SupabaseClient<Database>`.

- [ ] **Step 1: Generar los tipos**

Run: `make db.types && head -5 packages/db/types.ts`
Expected: empieza por `export type Json =` y contiene `user_role: "owner" | "employee"`.

- [ ] **Step 2: Excluir el archivo generado de Biome**

En `biome.json` → `files.includes` añade `"!**/packages/db/types.ts"`.

- [ ] **Step 3: Tipar los clientes**

`packages/api/package.json` → `dependencies`: añade `"@clinicalumia/db": "workspace:*"` y ejecuta `pnpm install`.

`packages/api/server.ts`: importa `import type { Database } from "@clinicalumia/db";` y cambia `createServerClient(` por `createServerClient<Database>(`.
`packages/api/browser.ts`: igual con `createBrowserClient<Database>(`.
`packages/api/admin.ts`: igual con `createSupabaseClient<Database>(`.

- [ ] **Step 4: Verificar que el tipado detecta errores reales**

Run: `make typecheck`
Expected: PASS. Si algún `select` del admin usa una columna inexistente, el error aparece ahora: corrígelo en el mismo paso.

- [ ] **Step 5: Añadir la comprobación de tipos desactualizados al Makefile**

Añade a `.PHONY` `db.types.check` y:

```makefile
db.types.check: ## Falla si packages/db/types.ts no coincide con las migraciones
	@cd $(DB) && supabase gen types typescript --local | diff -q - types.ts >/dev/null || \
	 (echo "types.ts está desactualizado: ejecuta make db.types"; exit 1)
```

Run: `make db.types.check`
Expected: sin salida, código 0.

- [ ] **Step 6: Commit**

```bash
git add packages/db/types.ts packages/api biome.json Makefile pnpm-lock.yaml
git commit -m "Tipar los clientes de Supabase con el esquema generado"
```

---

### Task 6: Las acciones con clave de servicio comprueban que llama la propietaria

**Files:**
- Create: `packages/api/auth.ts`, `packages/api/auth.test.ts`, `packages/api/vitest.config.ts`
- Modify: `packages/api/package.json`, `apps/admin/app/(admin)/team/actions.ts`

**Interfaces:**
- Produces: `requireOwner(supabase: SupabaseClient<Database>): Promise<{ ok: true; userId: string } | { ok: false; error: string }>`, exportado como `@clinicalumia/api/auth`.

- [ ] **Step 1: Configurar Vitest en `packages/api`**

Run: `pnpm --filter @clinicalumia/api add -D vitest`

`packages/api/package.json`: añade `"./auth": "./auth.ts"` a `exports`, `"auth.ts"` a `files` y `"test": "vitest run"` a `scripts`.

`packages/api/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["**/*.test.ts"] } });
```

- [ ] **Step 2: Escribir los tests que fallan**

`packages/api/auth.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { requireOwner } from "./auth";

function fakeClient(
  user: { id: string } | null,
  profile: { role: string; is_active: boolean } | null,
) {
  return {
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: profile }) }),
      }),
    }),
  } as unknown as Parameters<typeof requireOwner>[0];
}

describe("requireOwner", () => {
  it("lets the active owner through", async () => {
    const result = await requireOwner(
      fakeClient({ id: "u1" }, { role: "owner", is_active: true }),
    );
    expect(result).toEqual({ ok: true, userId: "u1" });
  });

  it("rejects an employee who calls an admin action directly, before any service-role key is used", async () => {
    const result = await requireOwner(
      fakeClient({ id: "u2" }, { role: "employee", is_active: true }),
    );
    expect(result).toEqual({ ok: false, error: "No tienes permiso para hacer esto." });
  });

  it("rejects a deactivated owner", async () => {
    const result = await requireOwner(
      fakeClient({ id: "u1" }, { role: "owner", is_active: false }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects a request without a session", async () => {
    const result = await requireOwner(fakeClient(null, null));
    expect(result.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Ejecutar y ver el fallo**

Run: `pnpm --filter @clinicalumia/api test`
Expected: FAIL — `Cannot find module './auth'`.

- [ ] **Step 4: Implementar `packages/api/auth.ts`**

```ts
import type { Database } from "@clinicalumia/db";
import type { SupabaseClient } from "@supabase/supabase-js";

const denied = { ok: false, error: "No tienes permiso para hacer esto." } as const;

export async function requireOwner(
  supabase: SupabaseClient<Database>,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return denied;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "owner" || !profile.is_active) return denied;
  return { ok: true, userId: user.id };
}
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `pnpm --filter @clinicalumia/api test`
Expected: PASS, 4 tests.

- [ ] **Step 6: Usarlo en las acciones de equipo**

En `apps/admin/app/(admin)/team/actions.ts`:

1. Añade `import { requireOwner } from "@clinicalumia/api/auth";`.
2. Al principio de `createMember`, antes de validar campos:

```ts
  const owner = await requireOwner(await createClient());
  if (!owner.ok) return { error: owner.error };
```

3. Sustituye `resendInvite` por:

```ts
export async function resendInvite(email: string): Promise<ActionResult> {
  const owner = await requireOwner(await createClient());
  if (!owner.ok) return { error: owner.error };

  const { error } = await createAdminClient().auth.admin.inviteUserByEmail(email);
  if (error) return { error: "No se ha podido reenviar la invitación." };

  revalidatePath("/team");
  return { ok: true };
}
```

`ActionResult` se define en la Tarea 7; hasta entonces declara al principio del archivo `type ActionResult = { ok: true } | { error: string };` (la Tarea 7 lo mueve a un módulo común).

- [ ] **Step 7: Verificar**

Run: `make typecheck && make test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/api apps/admin pnpm-lock.yaml
git commit -m "Comprobar que es la propietaria antes de usar la clave de servicio en el admin"
```

---

### Task 7: Las acciones del admin devuelven y muestran sus errores

**Files:**
- Create: `apps/admin/lib/action-result.ts`, `apps/admin/app/(admin)/specialties/actions.test.ts`, `apps/admin/vitest.config.ts`
- Modify: `apps/admin/package.json`, `apps/admin/app/(admin)/specialties/actions.ts`, `apps/admin/app/(admin)/specialties/SpecialtyRow.tsx`, `apps/admin/app/(admin)/team/actions.ts`, `apps/admin/app/(admin)/team/MemberRow.tsx`

**Interfaces:**
- Consumes: `requireOwner` (Tarea 6).
- Produces: `export type ActionResult = { ok: true } | { error: string }` en `apps/admin/lib/action-result.ts`. `renameSpecialty`, `deleteSpecialty`, `updateMember`, `setMemberActive`, `resendInvite` devuelven `Promise<ActionResult>`.

- [ ] **Step 1: Configurar Vitest en el admin**

Run: `pnpm --filter admin add -D vitest`

`apps/admin/package.json` → `scripts`: `"test": "vitest run"`.

`apps/admin/vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["**/*.test.ts"] },
});
```

`apps/admin/lib/action-result.ts`:

```ts
export type ActionResult = { ok: true } | { error: string };
```

- [ ] **Step 2: Escribir el test que falla**

`apps/admin/app/(admin)/specialties/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const result = { error: null as null | { code: string; message: string } };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@clinicalumia/api/server", () => ({
  createClient: async () => ({
    from: () => ({
      update: () => ({ eq: async () => result }),
      delete: () => ({ eq: async () => result }),
    }),
  }),
}));

const { deleteSpecialty, renameSpecialty } = await import("./actions");

function nameForm(name: string) {
  const data = new FormData();
  data.set("name", name);
  return data;
}

describe("specialty actions", () => {
  beforeEach(() => {
    result.error = null;
  });

  it("reports a failed delete instead of pretending it worked", async () => {
    result.error = { code: "23503", message: "fk" };
    expect(await deleteSpecialty("id")).toEqual({
      error: "No se puede eliminar: hay servicios que usan esta especialidad.",
    });
  });

  it("reports a rename that clashes with an existing specialty", async () => {
    result.error = { code: "23505", message: "dup" };
    expect(await renameSpecialty("id", nameForm("Logopedia"))).toEqual({
      error: "Ya existe una especialidad con ese nombre.",
    });
  });

  it("rejects an empty name without touching the database", async () => {
    expect(await renameSpecialty("id", nameForm("  "))).toEqual({
      error: "El nombre es obligatorio.",
    });
  });

  it("confirms a successful rename", async () => {
    expect(await renameSpecialty("id", nameForm("Psicología"))).toEqual({ ok: true });
  });
});
```

- [ ] **Step 3: Ejecutar y ver el fallo**

Run: `pnpm --filter admin test`
Expected: FAIL — `deleteSpecialty` devuelve `undefined`.

- [ ] **Step 4: Implementar en `specialties/actions.ts`**

Añade `import type { ActionResult } from "@/lib/action-result";` y sustituye `renameSpecialty` y `deleteSpecialty` por:

```ts
export async function renameSpecialty(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("specialties")
    .update({ name, slug: slugify(name) })
    .eq("id", id);

  if (error?.code === "23505")
    return { error: "Ya existe una especialidad con ese nombre." };
  if (error) return { error: "No se ha podido renombrar la especialidad." };

  revalidatePath("/specialties");
  return { ok: true };
}

export async function deleteSpecialty(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("specialties").delete().eq("id", id);

  if (error?.code === "23503")
    return {
      error: "No se puede eliminar: hay servicios que usan esta especialidad.",
    };
  if (error) return { error: "No se ha podido eliminar la especialidad." };

  revalidatePath("/specialties");
  return { ok: true };
}
```

- [ ] **Step 5: Ejecutar y ver que pasa**

Run: `pnpm --filter admin test`
Expected: PASS, 4 tests.

- [ ] **Step 6: Mostrar el error en `SpecialtyRow.tsx`**

Añade estado `const [error, setError] = useState<string | null>(null);`. En el formulario de edición:

```tsx
action={(formData) =>
  startTransition(async () => {
    const result = await renameSpecialty(specialty.id, formData);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    setEditing(false);
  })
}
```

En el botón eliminar: `startTransition(async () => { const result = await deleteSpecialty(specialty.id); setError("error" in result ? result.error : null); })`. Tras los botones, en ambas ramas:

```tsx
{error && (
  <p role="alert" data-testid="specialty-error" className="w-full text-sm text-red-600">
    {error}
  </p>
)}
```

- [ ] **Step 7: Lo mismo en equipo**

En `team/actions.ts` importa `ActionResult` desde `@/lib/action-result` (borra la declaración local de la Tarea 6) y sustituye `updateMember` y `setMemberActive` por:

```ts
export async function updateMember(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const specialtyId = String(formData.get("specialty_id") ?? "") || null;
  if (!fullName) return { error: "El nombre es obligatorio." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, specialty_id: specialtyId })
    .eq("id", id);
  if (error) return { error: "No se han podido guardar los cambios." };

  revalidatePath("/team");
  return { ok: true };
}

export async function setMemberActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) return { error: "No se ha podido cambiar el estado." };

  revalidatePath("/team");
  return { ok: true };
}
```

En `MemberRow.tsx`:

1. Añade `const [error, setError] = useState<string | null>(null);` y la función:

```tsx
const run = (action: () => Promise<{ ok: true } | { error: string }>, onOk?: () => void) =>
  startTransition(async () => {
    const result = await action();
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    onOk?.();
  });
```

2. Formulario de edición: `action={(formData) => run(() => updateMember(member.id, formData), () => setEditing(false))}`.
3. Reenviar: `onClick={() => run(() => resendInvite(member.email))}`.
4. Activar o desactivar: `onClick={() => run(() => setMemberActive(member.id, !member.is_active))}`.
5. Al final de ambas ramas del `<li>`:

```tsx
{error && (
  <p role="alert" data-testid="member-error" className="w-full text-sm text-red-600">
    {error}
  </p>
)}
```

- [ ] **Step 8: Verificar**

Run: `make lint && make typecheck && make test`
Expected: PASS.

Manual: `make dev.admin`, entra con la propietaria local, crea una especialidad "Prueba", renómbrala a una ya existente → aparece "Ya existe una especialidad con ese nombre." bajo la fila.

- [ ] **Step 9: Commit**

```bash
git add apps/admin pnpm-lock.yaml
git commit -m "Mostrar en el admin los errores de especialidades y equipo en lugar de ignorarlos"
```

---

### Task 8: Invitación, contraseña y recuperación en el dashboard

**Files:**
- Create: `apps/dashboard/lib/password.ts`, `apps/dashboard/lib/password.test.ts`, `apps/dashboard/vitest.config.ts`, `apps/dashboard/app/auth/confirm/route.ts`, `apps/dashboard/app/auth/contrasena/page.tsx`, `apps/dashboard/app/auth/contrasena/actions.ts`, `apps/dashboard/app/login/recuperar/page.tsx`, `apps/dashboard/app/login/recuperar/actions.ts`, `apps/dashboard/app/login/LoginForm.tsx`, `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/mail.ts`, `e2e/invite.spec.ts`
- Modify: `apps/dashboard/package.json`, `apps/dashboard/app/login/page.tsx`, `pnpm-workspace.yaml`, `Makefile`

**Interfaces:**
- Consumes: plantillas con `/auth/confirm?token_hash=…&type=invite|recovery` (Tarea 3); `createClient` tipado (Tarea 5).
- Produces: `validateNewPassword(password: string, confirmation: string): string | null`; rutas `/auth/confirm`, `/auth/contrasena`, `/login/recuperar`; `make test.e2e`.

- [ ] **Step 1: Test de la validación de contraseña (falla)**

Run: `pnpm --filter dashboard add -D vitest`; `apps/dashboard/package.json` → `"test": "vitest run"`.

`apps/dashboard/vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["**/*.test.ts"] },
});
```

`apps/dashboard/lib/password.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { validateNewPassword } from "./password";

describe("validateNewPassword", () => {
  it("accepts a long enough password typed twice", () => {
    expect(validateNewPassword("lumia-segura-2026", "lumia-segura-2026")).toBeNull();
  });

  it("rejects short passwords, since these accounts protect health data", () => {
    expect(validateNewPassword("corta", "corta")).toBe(
      "La contraseña debe tener al menos 12 caracteres.",
    );
  });

  it("rejects a confirmation that does not match, to avoid locking the user out", () => {
    expect(validateNewPassword("lumia-segura-2026", "lumia-segura-2027")).toBe(
      "Las contraseñas no coinciden.",
    );
  });
});
```

Run: `pnpm --filter dashboard test` → Expected: FAIL (`Cannot find module './password'`).

- [ ] **Step 2: Implementar `apps/dashboard/lib/password.ts`**

```ts
const MIN_LENGTH = 12;

export function validateNewPassword(
  password: string,
  confirmation: string,
): string | null {
  if (password.length < MIN_LENGTH)
    return `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`;
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  return null;
}
```

Run: `pnpm --filter dashboard test` → Expected: PASS, 3 tests.

- [ ] **Step 3: Paquete e2e y test de extremo a extremo (falla primero)**

`pnpm-workspace.yaml`: añade `- "e2e"`.

`e2e/package.json`:

```json
{
  "name": "@clinicalumia/e2e",
  "private": true,
  "type": "module",
  "scripts": { "test:e2e": "playwright test" },
  "devDependencies": { "@playwright/test": "^1.55.0", "@supabase/supabase-js": "^2.46.1" }
}
```

Run: `pnpm install && pnpm --filter @clinicalumia/e2e exec playwright install chromium`

`e2e/playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  use: { baseURL: "http://localhost:3001" },
  webServer: {
    command: "pnpm --filter dashboard dev",
    url: "http://localhost:3001/login",
    reuseExistingServer: true,
    cwd: "..",
  },
});
```

`e2e/mail.ts`:

```ts
const MAILPIT = "http://127.0.0.1:54324/api/v1";

export async function latestLinkFor(email: string, path: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { messages } = await (await fetch(`${MAILPIT}/messages`)).json();
    const message = messages.find((m: { To: { Address: string }[] }) =>
      m.To.some((to) => to.Address === email),
    );
    if (message) {
      const { HTML } = await (await fetch(`${MAILPIT}/message/${message.ID}`)).json();
      const href = /href="([^"]+)"/.exec(HTML)?.[1];
      if (href?.includes(path)) return href.replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No ha llegado el email a ${email}`);
}
```

`e2e/invite.spec.ts`:

```ts
import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { latestLinkFor } from "./mail";

const serviceKey = execSync("cd ../packages/db && supabase status -o env")
  .toString()
  .match(/^SERVICE_ROLE_KEY="?([^"\n]+)/m)?.[1];

const admin = createClient("http://127.0.0.1:54321", serviceKey ?? "");

test("an invited employee sets a password and lands in the dashboard", async ({ page }) => {
  const email = `empleado-${Date.now()}@test.local`;
  const { data } = await admin.auth.admin.inviteUserByEmail(email);
  await admin.from("profiles").insert({
    id: data.user!.id, email, full_name: "Empleada de prueba", role: "employee",
  });

  await page.goto(await latestLinkFor(email, "/auth/confirm"));
  await page.fill('[name="password"]', "corta");
  await page.fill('[name="confirmation"]', "corta");
  await page.getByTestId("password-submit").click();
  await expect(page.getByTestId("password-error")).toContainText("12 caracteres");
  await expect(page.locator('[name="password"]')).toHaveValue("corta");

  await page.fill('[name="password"]', "lumia-segura-2026");
  await page.fill('[name="confirmation"]', "lumia-segura-2026");
  await page.getByTestId("password-submit").click();
  await expect(page.getByRole("heading", { name: /Empleada de prueba/ })).toBeVisible();
});

test("a used or expired invite link sends you to login with an explanation", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=caducado&type=invite");
  await expect(page).toHaveURL(/\/login\?error=enlace/);
  await expect(page.getByTestId("login-link-expired")).toContainText("ha caducado o ya se usó");
});
```

Añade al `Makefile` (y a `.PHONY`): 

```makefile
test.e2e: db.start ## Tests de extremo a extremo (Playwright) contra Supabase local
	pnpm --filter @clinicalumia/e2e test:e2e
```

Run: `make test.e2e`
Expected: FAIL — `/auth/confirm` responde 404, así que no aparece el formulario de contraseña ni el aviso del login.

- [ ] **Step 4: Ruta que valida el enlace del email**

`apps/dashboard/app/auth/confirm/route.ts`:

```ts
import { createClient } from "@clinicalumia/api/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

const allowed: EmailOtpType[] = ["invite", "recovery"];

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type && allowed.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL("/auth/contrasena", request.url));
    }
  }

  return NextResponse.redirect(new URL("/login?error=enlace", request.url));
}
```

`apps/dashboard/package.json` → `dependencies`: `"@supabase/supabase-js": "^2.46.1"` (para el tipo) y `pnpm install`.

- [ ] **Step 5: Página para fijar la contraseña**

`apps/dashboard/app/auth/contrasena/actions.ts`:

```ts
"use server";

import { createClient } from "@clinicalumia/api/server";
import { redirect } from "next/navigation";
import { validateNewPassword } from "@/lib/password";

export type PasswordState = { error: string } | undefined;

export async function setPassword(
  _prev: PasswordState,
  formData: FormData,
): Promise<PasswordState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirmation") ?? "");
  const invalid = validateNewPassword(password, confirmation);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "No se ha podido guardar la contraseña. Pide un enlace nuevo." };

  redirect("/");
}
```

`apps/dashboard/app/auth/contrasena/page.tsx` (cliente; mismo estilo que `login/page.tsx`, que el plan 1b restilará):

```tsx
"use client";

import { startTransition, useActionState } from "react";
import { type PasswordState, setPassword } from "./actions";

const initialState: PasswordState = undefined;

export default function SetPasswordPage() {
  const [state, formAction, pending] = useActionState(setPassword, initialState);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <form
        data-testid="password-form"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => formAction(formData));
        }}
        className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-center text-2xl font-semibold text-slate-900">Elige tu contraseña</h1>
        <label className="block space-y-1 text-sm">
          <span className="text-slate-700">Contraseña (mínimo 12 caracteres)</span>
          <input type="password" name="password" required autoComplete="new-password"
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-slate-700">Repite la contraseña</span>
          <input type="password" name="confirmation" required autoComplete="new-password"
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2" />
        </label>
        {state?.error && (
          <p role="alert" data-testid="password-error" className="text-sm text-red-600">{state.error}</p>
        )}
        <button type="submit" disabled={pending} data-testid="password-submit"
          className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {pending ? "Guardando…" : "Guardar y entrar"}
        </button>
      </form>
    </main>
  );
}
```

El `onSubmit` con `startTransition` evita que React vacíe el formulario cuando hay error (mismo arreglo que en `/consentimiento`).

- [ ] **Step 6: Recuperar contraseña y aviso de enlace caducado**

`apps/dashboard/app/login/recuperar/actions.ts`:

```ts
"use server";

import { createClient } from "@clinicalumia/api/server";

export type RecoverState = { sent: true } | { error: string } | undefined;

export async function requestRecovery(
  _prev: RecoverState,
  formData: FormData,
): Promise<RecoverState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Escribe tu email." };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email);
  return { sent: true };
}
```

La respuesta es siempre "enviado", exista o no la cuenta, para no revelar qué emails tienen acceso.

`apps/dashboard/app/login/recuperar/page.tsx`:

```tsx
"use client";

import { startTransition, useActionState } from "react";
import { type RecoverState, requestRecovery } from "./actions";

const initialState: RecoverState = undefined;

export default function RecoverPage() {
  const [state, formAction, pending] = useActionState(requestRecovery, initialState);

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      {state && "sent" in state ? (
        <p data-testid="recover-sent" className="max-w-sm text-center text-slate-700">
          Si el email tiene cuenta, te hemos enviado un enlace para cambiar la contraseña.
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => formAction(formData));
          }}
          className="w-full max-w-sm space-y-6 rounded-xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <h1 className="text-center text-2xl font-semibold text-slate-900">Recuperar contraseña</h1>
          <label className="block space-y-1 text-sm">
            <span className="text-slate-700">Email</span>
            <input type="email" name="email" required autoComplete="email" data-testid="recover-email"
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2" />
          </label>
          {state && "error" in state && (
            <p role="alert" className="text-sm text-red-600">{state.error}</p>
          )}
          <button type="submit" disabled={pending} data-testid="recover-submit"
            className="w-full rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {pending ? "Enviando…" : "Enviarme el enlace"}
          </button>
        </form>
      )}
    </main>
  );
}
```

El login actual es un componente cliente. Para leer `?error=enlace` sin `useSearchParams`, sepáralo en dos:

1. Mueve el contenido de `apps/dashboard/app/login/page.tsx` tal cual a `apps/dashboard/app/login/LoginForm.tsx`, renombrando el componente a `LoginForm` y añadiendo la prop `linkExpired: boolean`.
2. Dentro del `<form>` de `LoginForm`, antes de los campos:

```tsx
{linkExpired && (
  <p role="alert" data-testid="login-link-expired" className="text-sm text-red-600">
    El enlace ha caducado o ya se usó. Pide uno nuevo desde «¿Has olvidado tu contraseña?».
  </p>
)}
```

y bajo el botón de entrar:

```tsx
<a href="/login/recuperar" className="block text-center text-sm text-slate-600 underline">
  ¿Has olvidado tu contraseña?
</a>
```

3. Nuevo `apps/dashboard/app/login/page.tsx` (servidor):

```tsx
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginForm linkExpired={error === "enlace"} />;
}
```

- [ ] **Step 7: Ejecutar y ver que pasa**

Run: `make test.e2e`
Expected: PASS, 2 tests.

- [ ] **Step 8: Verificar el resto**

Run: `make lint && make typecheck && make test && make test.db`
Expected: todo en verde.

- [ ] **Step 9: Commit (dos commits pequeños)**

```bash
git add apps/dashboard/lib apps/dashboard/vitest.config.ts apps/dashboard/package.json pnpm-lock.yaml
git commit -m "Validar la contraseña nueva del personal"
git add apps/dashboard/app e2e pnpm-workspace.yaml Makefile pnpm-lock.yaml
git commit -m "Permitir aceptar la invitación y recuperar la contraseña desde el dashboard"
```

---

### Task 9: Primera sincronización con `lumia-db-dev`

Tarea de operación: toca una base de datos compartida. **Pide confirmación a la persona responsable antes de cada comando que escribe en remoto.**

**Files:**
- Create (no versionado): `packages/db/.env.dev`

- [ ] **Step 1: Pedir los datos de dev**

Solicita `DATABASE_URL` (Session pooler), `SUPABASE_PROJECT_REF`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` de `lumia-db-dev` y escríbelos en `packages/db/.env.dev` según `.env.example`. Ejecuta `supabase login` si la CLI lo pide (la persona lo hace con `! supabase login`).

- [ ] **Step 2: Ver el estado**

Run: `make db.status`
Expected: todas las migraciones con dev "pendiente" (o las que ya existan con ✓). Si `.env.prod` aún no existe, créalo vacío salvo `DATABASE_URL` de prod cuando se tenga; hasta entonces ejecuta solo `make db.push.dev`.

- [ ] **Step 3: Aplicar (con confirmación)**

Run: `make db.push.dev` y después `make db.config.dev`
Expected: "Finished supabase db push." y la configuración aplicada sin errores.

- [ ] **Step 4: Comprobar**

Run: `make db.status`
Expected: todas con ✓ en dev.

Sin commit: no cambia archivos versionados.

---

## Siguiente

Al cerrar este plan: escribir **1b · Sistema de diseño** (`packages/ui`, tokens y fuentes compartidos con test visual de la web, componentes shadcn restilados, armazón de admin y dashboard y restilado de login y contraseña) y **1c · Configuración del admin y publicación** (servicios, horarios y ausencias, datos de facturación con logo, política de cancelación, equipo con nº de colegiado, publicación en Vercel de `panel.` y `admin.`, producción y verificación en dos pasos).
