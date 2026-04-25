# Deploy a Vercel — Guía manual

Esta guía la tienes que ejecutar tú (Carlos). Claude no puede hacer login en Vercel ni en GitHub, así que estos pasos son manuales. Tarda ~15 minutos la primera vez.

> **Antes de empezar:** asegúrate que `npx tsc --noEmit` y `npm run build` pasan localmente sin errores. Si fallan, no sigas — Vercel va a fallar igual.

---

## 1. Crear cuenta en Vercel

1. Ir a <https://vercel.com/signup>.
2. Hacer "Continue with GitHub" (es lo más fácil porque después conecta con el repo).
3. Aceptar el plan **Hobby** (gratis, alcanza de sobra para este proyecto).

---

## 2. Subir el código a GitHub

El proyecto ya está inicializado como repo git local (rama `master`).

1. Ir a <https://github.com/new> y crear un repo **privado** llamado `clubpm-kayak` (o el nombre que prefieras). **No** marques "Add a README", "Add .gitignore" ni "Add a license" — el repo local ya los tiene.

2. Apuntar el remoto y empujar:

   ```bash
   git remote add origin git@github.com:<TU_USUARIO>/clubpm-kayak.git
   git branch -M main           # opcional: renombrar master -> main
   git push -u origin main
   ```

   Si usas HTTPS en vez de SSH, la URL es `https://github.com/<TU_USUARIO>/clubpm-kayak.git`.

3. Verificar en GitHub que **NO** aparece el archivo `.env.local` en el repo. El `.gitignore` ya lo excluye, pero confirmar nunca está de más.

---

## 3. Importar el repo en Vercel

1. En Vercel, click en **Add New… → Project**.
2. Seleccionar el repo `clubpm-kayak`. Si no aparece, click en "Adjust GitHub App Permissions" y darle acceso al repo.
3. En la pantalla de configuración:
   - **Framework preset:** Next.js (debería detectarlo solo).
   - **Root directory:** dejar en `./`.
   - **Build command:** dejar en blanco (usa `vercel-build` del package.json).
   - **Output directory:** dejar en blanco.
   - **Install command:** `npm install --legacy-peer-deps` (importante por React 19 / Next 16).

4. **NO** hacer click en "Deploy" todavía. Primero las env vars.

---

## 4. Configurar variables de entorno

En la misma pantalla, expandir "Environment Variables" y agregar las siguientes. Tomar los valores reales del `.env.local` que tienes en tu máquina.

| Variable                          | Valor                                                       | Entorno                           |
|-----------------------------------|-------------------------------------------------------------|-----------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`        | `https://klwozyqryqndwzysetcj.supabase.co`                  | Production, Preview, Development  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | `sb_publishable_…` (la que tienes en .env.local)            | Production, Preview, Development  |
| `NEXT_PUBLIC_ADMIN_RUT`           | `17353638-0`                                                | Production, Preview, Development  |
| `SESSION_SECRET`                  | el mismo valor de tu .env.local (32+ chars random)          | Production, Preview, Development  |
| `NEXT_PUBLIC_APP_URL`             | `https://clubpm-kayak.vercel.app` (ajustar tras deploy)     | Production                        |
| `CRON_SECRET`                     | valor aleatorio largo (`openssl rand -hex 32`)              | Production                        |
| `ADMIN_TELEFONO`                  | `56XXXXXXXXX` (sin + ni espacios)                           | Production                        |

> **Importante:** las variables `NEXT_PUBLIC_*` se inyectan en el bundle del cliente. No poner ahí cosas secretas. La `SUPABASE_ANON_KEY` está bien porque es pública por diseño.

---

## 5. Primer deploy

1. Click en **Deploy**.
2. Esperar 2-3 minutos. Vercel corre `npm install --legacy-peer-deps` y luego `vercel-build` (que es `next build`).
3. Si falla, mirar el log de build. Errores típicos:
   - **"Module not found"** → falta un import o la variable de entorno.
   - **"Type error"** → corre `npx tsc --noEmit` localmente y arregla.
   - **"Supabase fetch failed"** → revisar que `NEXT_PUBLIC_SUPABASE_URL` está bien escrita.

4. Cuando termine, Vercel te da una URL tipo `https://clubpm-kayak-xxxx.vercel.app`. Probarla:
   - Te debe redirigir a `/login`.
   - Iniciar sesión con tu RUT y PIN.
   - Verificar que el dashboard carga datos reales de Supabase.

---

## 6. Ajustar `NEXT_PUBLIC_APP_URL` con la URL real

Después del primer deploy, Vercel te asigna una URL definitiva (ej: `https://clubpm-kayak.vercel.app`).

1. Ir a **Settings → Environment Variables**.
2. Editar `NEXT_PUBLIC_APP_URL` y poner la URL real.
3. Ir a **Deployments**, abrir el último deploy y click en **Redeploy** (sin cambiar nada). Las env vars solo se aplican en builds nuevos.

Esto hace que los mensajes de WhatsApp con el link al estado de cuenta del socio (`/mi/<rut>`) usen la URL de producción y no `localhost`.

---

## 7. Configurar dominio custom (opcional)

Si tienes un dominio propio (ej: `clubpmkayak.cl`):

1. **Settings → Domains → Add**.
2. Escribir el dominio y seguir las instrucciones de DNS (Vercel te dice qué registros A/CNAME agregar en tu registrador).
3. Esperar la propagación (~5-30 minutos).
4. Actualizar `NEXT_PUBLIC_APP_URL` al dominio nuevo y redeploy.

---

## 8. Configurar el cron de resumen de morosos (opcional, ver Sprint 5)

El endpoint `/api/cron/resumen-morosos` está protegido con `CRON_SECRET`. Para que Vercel lo dispare automáticamente, agregar a `vercel.json`:

```json
{
  "framework": "nextjs",
  "regions": ["gru1"],
  "crons": [
    {
      "path": "/api/cron/resumen-morosos",
      "schedule": "0 12 * * *"
    }
  ]
}
```

(Cron syntax: `0 12 * * *` = todos los días a las 12:00 UTC = 09:00 Chile.)

Vercel envía la request con el header `Authorization: Bearer <CRON_SECRET>` automáticamente cuando configuras un cron desde `vercel.json` y la env var existe.

> Los crons solo funcionan en plan Hobby con un máximo de 2 jobs. Suficiente.

---

## 9. Verificar que todo quedó bien

Checklist post-deploy:

- [ ] `/login` carga y permite autenticarse
- [ ] `/dashboard` muestra los KPIs reales
- [ ] `/socios` lista los socios
- [ ] `/socios/<id>` muestra detalle con historial
- [ ] `/movimientos` permite registrar un pago de prueba
- [ ] El botón WhatsApp arma un link `wa.me/...` con el mensaje correcto y la URL de prod
- [ ] No aparecen warnings de "missing env var" en los logs (`Deployments → Logs`)

---

## Si algo se rompe

- **Logs en vivo:** `Deployments → <deploy> → Functions → ver logs`.
- **Rollback:** en `Deployments`, abrir un deploy viejo y click en **Promote to Production**.
- **Borrar y reimportar:** si quedó un estado raro, borrar el proyecto en Vercel (Settings → Advanced → Delete) y reimportar desde GitHub. Las env vars se pierden, pero ya están documentadas arriba.
