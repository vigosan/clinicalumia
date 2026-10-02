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

## Activar el captcha de la web (Cloudflare Turnstile)

`/acceder` y `/consentimiento` llevan un captcha opcional. Está apagado mientras falte cualquiera de las dos claves `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` de la web; con las dos, se enciende sin tocar código.

1. En Cloudflare, *Turnstile › Add widget*: nombre «LUMIA web», hostnames `clinicalumia.es` y `www.clinicalumia.es`, modo *Managed*. No hace falta tener el dominio en Cloudflare.
2. Copia la *Site Key* y la *Secret Key*.
3. En Vercel, proyecto de la web, *Settings › Environment Variables*: añade `TURNSTILE_SITE_KEY` y `TURNSTILE_SECRET_KEY` solo en *Production*. En *Preview* y en local se dejan vacías: el servidor solo acepta respuestas resueltas en `clinicalumia.es` o `www.clinicalumia.es`, así que con las claves puestas en una preview nadie podría enviar los formularios.
4. Vuelve a desplegar producción (Vercel aplica las variables en el siguiente despliegue). Las páginas leen las claves en cada petición, no al compilar.
5. Comprueba en `https://www.clinicalumia.es/acceder` y en `/consentimiento` que aparece el captcha y que el formulario se envía.

Cómo se comporta:

- El servidor rechaza el envío si falta la respuesta del captcha, si Cloudflare no la da por buena, si se resolvió en otro dominio o si se resolvió para el otro formulario (cada formulario tiene su acción: `acceder` o `consentimiento`).
- Si Cloudflare no contesta en 5 segundos o devuelve un error, el formulario no se envía y se pide probar en unos minutos o llamar al 614 552 808. Es deliberado: mientras el captcha esté encendido, nada pasa sin comprobar.
- El script de Cloudflare solo se carga en esas dos páginas y solo con las claves puestas. La web no tiene `Content-Security-Policy`; si algún día se añade, debe permitir `https://challenges.cloudflare.com` en `script-src` y `frame-src`.
- Para apagarlo, borra cualquiera de las dos variables en Vercel y vuelve a desplegar.

## Limpieza diaria de cuentas de acceso sin verificar

Pedir un código en `/acceder` crea un usuario de acceso aunque el código no se use nunca. Cada día, sobre las 03:00 UTC (Vercel Hobby lo lanza dentro de esa hora), el cron `/api/cron/cuentas-sin-verificar` de la web borra con la clave de servicio los usuarios que cumplen todo esto:

- nunca han entrado (`last_sign_in_at` vacío);
- se crearon hace más de 7 días y no han pedido otro código en esos 7 días (`recovery_sent_at` vacío o anterior), para no romper un código que está de camino;
- no tienen cuenta de paciente (`patient_accounts`);
- no son del equipo (no tienen fila en `profiles`);
- no tienen invitación (`invited_at` vacío), pendiente o no.

No se mira si el email está confirmado: `/acceder` crea los usuarios ya confirmados, así que ese dato no distingue a nadie.

- Usa el mismo `CRON_SECRET` que los recordatorios: sin él, o con otro, responde `401` y no borra nada.
- Si no puede leer los usuarios, el equipo o las cuentas de paciente, falla sin borrar nada. Si falla un borrado, sigue con el resto y lo cuenta.
- Justo antes de borrar cada usuario lo vuelve a leer y lo deja si entretanto ha entrado, ha pedido otro código o ya no existe.
- Borra como mucho 100 cuentas por día. Si hay más candidatas, no borra ninguna, deja en el log solo cuántas eran y responde `500`, así que la ejecución sale fallida en Vercel: revisa antes qué ha pasado (un error o un ataque) y lánzalo a mano cuando esté claro.
- Cada ejecución deja en el log `{ deleted, failed }`, aunque no haya borrado nada.
- La programación está en `apps/web/vercel.json`. Hobby permite hasta 100 crons por proyecto, cada uno como mucho una vez al día.
- Para lanzarlo a mano en local, con la web arrancada: `curl -H "Authorization: Bearer lumia-cron-local" http://localhost:3000/api/cron/cuentas-sin-verificar`.
