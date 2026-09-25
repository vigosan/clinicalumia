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
