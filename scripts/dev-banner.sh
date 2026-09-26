#!/usr/bin/env bash
set -u

cat <<'EOF'
LUMIA · desarrollo local
Web        http://localhost:3000
Dashboard  http://localhost:3001
Admin      http://localhost:3002
Buzón      http://localhost:54324
Propietaria  info@clinicalumia.es / lumia-desarrollo-2026
Empleados    psicologia@lumia.test · fisioterapia@lumia.test (misma contraseña)
(make db.reset recarga estos datos)
EOF
