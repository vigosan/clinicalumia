# Operación

## Recuperar el 2FA de la propietaria

Si la propietaria pierde el móvil de la verificación en dos pasos, nadie de la clínica puede restablecérsela: desde Admin › Equipo solo se restablece la del equipo, y su propia cuenta queda excluida. La pantalla del código le pide que contacte con el soporte técnico.

Desde la raíz del repositorio, con las claves en `packages/db/.env.prod` (o `.env.dev`), como en `db.owner.prod`:

```bash
make db.owner.reset-mfa email=info@clinicalumia.es env=prod
```

- `env=prod` pide escribir `produccion`, y `env=dev` pide `desarrollo`. `env=local` usa el Supabase local y no pide confirmación.
- Antes de tocar nada, el script comprueba que el email es el de la propietaria. Con cualquier otra cuenta, o con un email que no existe, se para sin cambiar nada.
- Borra solo los factores de esa cuenta y cierra sus sesiones abiertas. La contraseña sigue siendo la misma.
- Al entrar de nuevo, el admin le pide configurar la verificación con el móvil nuevo.

Antes de lanzarlo, confirma por otra vía (teléfono o en persona) que la petición viene de la propietaria.
