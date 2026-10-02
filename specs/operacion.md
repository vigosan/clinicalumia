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
