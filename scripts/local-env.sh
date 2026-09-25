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
