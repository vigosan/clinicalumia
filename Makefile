SHELL := /bin/bash
.DEFAULT_GOAL := help
DB := packages/db

.PHONY: help doctor setup docker.up install env.local dev dev.web dev.admin dev.dashboard stop \
        build lint format typecheck test test.db clean \
        db.start db.stop db.reset db.migrate db.types db.studio db.mail db.bootstrap \
        db.status db.push.dev db.push.prod

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
