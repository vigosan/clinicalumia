SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install dev stop build lint typecheck test clean \
        db.start db.stop db.reset db.migrate db.types db.studio db.bootstrap

help: ## Show available commands
	@grep -hE '^[a-zA-Z_.-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install workspace dependencies
	pnpm install

dev: db.start ## Start full local stack (supabase + apps)
	pnpm turbo run dev

stop: db.stop ## Stop everything

build: ## Build all apps and packages
	pnpm turbo run build

lint: ## Lint all workspaces
	pnpm turbo run lint

typecheck: ## Typecheck all workspaces
	pnpm turbo run typecheck

test: ## Run tests across the monorepo
	pnpm turbo run test

clean: ## Remove build outputs and caches
	pnpm turbo run clean
	rm -rf node_modules

db.start: ## Start local Supabase (Postgres, Auth, Storage)
	cd packages/db && supabase start

db.stop: ## Stop local Supabase
	cd packages/db && supabase stop

db.reset: ## Reset local DB and re-apply migrations + seed
	cd packages/db && supabase db reset

db.migrate: ## Create new migration: make db.migrate name=add_patients
	@if [ -z "$(name)" ]; then echo "Usage: make db.migrate name=<migration_name>"; exit 1; fi
	cd packages/db && supabase migration new $(name)

db.types: ## Generate TypeScript types from local DB schema
	cd packages/db && supabase gen types typescript --local > types.ts

db.studio: ## Open Supabase Studio in browser
	open http://localhost:54323

db.bootstrap: ## Create the owner user. Usage: make db.bootstrap email=... password=... name="..."
	@if [ -z "$(email)" ] || [ -z "$(password)" ] || [ -z "$(name)" ]; then \
		echo 'Usage: make db.bootstrap email=user@example.com password=secret name="Dra. Patricia"'; \
		exit 1; \
	fi
	cd packages/db && \
		SUPABASE_URL=http://127.0.0.1:54321 \
		SUPABASE_SERVICE_ROLE_KEY=$$(supabase status -o env | grep '^SERVICE_ROLE_KEY=' | cut -d= -f2- | tr -d '"') \
		OWNER_EMAIL="$(email)" \
		OWNER_PASSWORD="$(password)" \
		OWNER_FULL_NAME="$(name)" \
		pnpm bootstrap:owner
