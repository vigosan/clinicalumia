SHELL := /bin/bash
.DEFAULT_GOAL := help

.PHONY: help install dev stop build lint typecheck test clean \
        db.start db.stop db.reset db.migrate db.types db.studio

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
