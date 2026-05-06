# Progreso de implementación — Club PM Kayak

> **Esta doc se actualiza al final de cada sprint o incremento significativo.**
> Si llegas como Claude (o como dev nuevo): leyendo este archivo deberías
> entender qué está hecho, qué quedó pendiente y por qué se decidió cada cosa.

Última actualización: **2026-05-05**

---

## 1. Resumen ejecutivo

| Área                          | Estado     | Notas                                                        |
|-------------------------------|------------|--------------------------------------------------------------|
| Schema Supabase               | ✅ Listo   | `socios`, `cuotas_config`, `movimientos`, función `verify_pin`, bucket `comprobantes` |
| Auth (RUT + PIN)              | ✅ Listo   | JWT en cookie httpOnly, middleware en todas las rutas        |
| Dashboard tesorero            | ✅ Listo   | KPIs en vivo + listado de morosos del mes                    |
| Gestión de socios             | ✅ Listo   | CRUD, búsqueda, filtros, vista de detalle con historial      |
| Movimientos                   | ✅ Listo   | Registro, listado con filtros, edición                       |
| Configuración cuota / mes     | ✅ Listo   | UI en `/configuracion` (antes era SQL puro)                  |
| Vista pública del socio       | ✅ Listo   | `/mi/[rut]` muestra estado mes a mes sin login               |
| WhatsApp (single)             | ✅ Listo   | Botón con mensaje pre-cargado por socio moroso               |
| WhatsApp (bulk)               | ✅ Listo   | Endpoint `/api/whatsapp/bulk` arma N urls a la vez           |
| Comprobantes (Storage)        | ✅ Listo   | Upload con validación, lectura por path                      |
| Importación Excel             | ✅ Listo   | Endpoints separados de socios y de pagos                     |
| Exportación Excel             | ✅ Listo   | Reportes de socios, recaudación y detalle por socio          |
| Cron resumen morosos          | ✅ Listo   | `/api/cron/resumen-morosos` protegido por `CRON_SECRET`      |
| Tests unitarios               | ✅ Listo   | Vitest, 22 casos en `lib/__tests__/`                         |
| CI                            | ✅ Listo   | GitHub Actions: typecheck + test + build en push/PR a main   |
| Deploy a Vercel               | ✅ Listo   | Live en <https://clubpm-kayak.vercel.app>. Repo en `carlosmundacafuenzalida-hue/clubpm-kayak` |
| Plantillas WhatsApp editables | ⛔ Pendiente | Mencionado en CLAUDE.md como Fase 3                          |
| Notificaciones automatizadas  | ⛔ Pendiente | El cron existe pero no manda mensajes solo                   |

---

## 2. Stack

- **Framework:** Next.js 16 (App Router, Server Components, Turbopack)
- **Lenguaje:** TypeScript strict
- **DB:** Supabase (PostgreSQL gestionado, proyecto `klwozyqryqndwzysetcj`)
- **Auth:** RUT + PIN → JWT firmado con `jose` en cookie `clubpm_session` (sin Supabase Auth)
- **Estilos:** Tailwind CSS v3 con paleta custom (verde bosque, amarillo kayak, azul río)
- **Tipografía:** Fraunces (display) + Geist (sans/mono) vía `next/font/google`
- **Tests:** Vitest + jsdom + @testing-library/react
- **CI:** GitHub Actions
- **Hosting (target):** Vercel, región `gru1` (São Paulo)

---

## 3. Estructura del repo (vista de pájaro)

```
app/
├── api/                          ← endpoints REST (todos validan sesión admin)
│   ├── login/, logout/
│   ├── socios/                   ← GET (lista), POST (crear), PATCH (editar)
│   ├── movimientos/              ← GET, POST (registrar), PATCH (editar)
│   ├── cuotas/                   ← GET, POST (configurar monto del mes)
│   ├── whatsapp/                 ← POST (single), bulk/ POST (N urls)
│   ├── comprobantes/             ← upload/ POST, [path]/ GET (lectura privada)
│   ├── importar/                 ← socios/ POST, pagos/ POST (xlsx → BD)
│   ├── reportes/                 ← recaudacion/, socio/[id]/, socios/ (xlsx export)
│   └── cron/resumen-morosos/     ← GET protegido por CRON_SECRET
├── login/page.tsx
├── dashboard/                    ← Server + Client component
├── socios/                       ← lista + [id] detalle
├── movimientos/                  ← lista + modal de registro
├── configuracion/                ← UI para monto de cuota mensual
├── importar/                     ← UI para subir Excel
├── mi/[rut]/                     ← vista pública del socio (sin login)
├── layout.tsx
└── globals.css

components/
├── brand.tsx                     ← BrandMark, BrandWordmark (SVG)
├── navbar.tsx, mini-header.tsx
├── rut-input.tsx                 ← input con normalización en vivo
└── pin-input.tsx                 ← 4 dígitos con auto-focus

lib/
├── supabase.ts                   ← clientes server/browser + tipos
├── rut.ts                        ← validar/normalizar/formatear
├── session.ts                    ← createSession, getSession, destroySession
├── movimientos.ts                ← calcularEstado, calcularDashboard, formatCLP, formatMes
├── excel.ts                      ← generación de planillas con ExcelJS
└── __tests__/                    ← rut.test.ts, movimientos.test.ts

middleware.ts                     ← redirige a /login si no hay cookie válida
.github/workflows/ci.yml          ← typecheck + test + build
vercel.json                       ← framework + region gru1
README-DEPLOY.md                  ← guía manual de deploy
```

---

## 4. Historial por sprint / incremento

### Sprint 0 — Bootstrap (commit `bd82b0c`)
- Init de Next.js 16 + Supabase scaffold + Vitest.

### Sprint 1 — Schema + Auth (commits `433776c` … `2b069a0`)
- Migración SQL inicial: tablas `socios`, `cuotas_config`, `movimientos`, función `verify_pin` con SHA256 + `SECURITY DEFINER`.
- Cliente Supabase server/browser con tipos compartidos.
- `lib/rut.ts` con normalización a formato canónico (`12345678-9`).
- `lib/session.ts` con JWT (`jose`) en cookie httpOnly `clubpm_session`.
- `RutInput` y `PinInput` (auto-focus 4 dígitos).
- Página `/login` con flujo RUT + PIN → `verify_pin` → cookie.
- Layout admin + `middleware.ts` que redirige a `/login` si no hay sesión.

### Sprint 2 — Dashboard + Socios + Movimientos (commits `9037628`, `fc09f5f`, `f57fc70`, `efae0ae`, `3ce6c2a`)
- `lib/movimientos.ts`: `calcularEstado`, `calcularDashboard`, `formatCLP`, `formatMes`, `mesActual`, `ultimosMeses`.
- Dashboard `/dashboard` con KPIs: socios activos, pagos del mes, morosos, recaudado.
- `/socios` con lista, búsqueda y filtros por estado.
- `/socios/[id]` con detalle e historial de pagos mes a mes.
- `/movimientos` con listado + modal de registro de pagos.
- `/mi/[rut]` vista pública del socio (sin login) con estado mes a mes.
- Endpoints REST: `/api/socios`, `/api/movimientos`.
- Botón WhatsApp con mensaje pre-cargado para morosos.

### Sprint 3 — Importación + Reportes (commits `8d5b38f`, `6137f77`, `f74e1a1`, `3c97ce1`)
- `lib/excel.ts` con generación de planillas con `ExcelJS` (paleta del club).
- Endpoints `/api/reportes/recaudacion`, `/api/reportes/socios`, `/api/reportes/socio/[id]`.
- `/configuracion`: UI para definir monto de cuota por mes (antes era SQL manual).
- `/importar`: UI para subir Excel.
- Endpoints `/api/importar/socios`, `/api/importar/pagos`.
- Carga histórica de 218 pagos importados desde Excel (data real del club).
- Fix de timezone aplicado en `lib/movimientos.ts`: usar `T12:00:00` al parsear fechas DATE de Supabase para evitar que UTC tire la fecha al día anterior en zona Chile.

### Sprint 4 — Comprobantes + WhatsApp bulk + Cron resumen
- Bucket Supabase Storage `comprobantes` (privado).
- `/api/comprobantes/upload` con validación de tipo (jpeg/png/pdf) y tamaño (5MB), nombres saneados.
- `/api/comprobantes/[path]` para lectura privada con sesión admin.
- `/api/whatsapp/bulk` que arma N urls de WhatsApp a la vez para campañas masivas.
- `/api/cron/resumen-morosos` protegido por header `Authorization: Bearer <CRON_SECRET>`. Devuelve resumen + url `wa.me/<ADMIN_TELEFONO>` con el detalle.
- Variables de entorno nuevas: `CRON_SECRET`, `ADMIN_TELEFONO`.
- Hardening: claves reales removidas de `.env.local.example` (commit `bf78c23`).

### Sprint 5 — Deploy a Vercel (esta sesión, sin commit aún)
- `vercel.json` con `framework: nextjs` y región `gru1` (São Paulo, latencia mínima a Chile).
- Script `vercel-build` agregado a `package.json` (alias de `next build`).
- Variable `NEXT_PUBLIC_APP_URL` agregada a `.env.local.example` y consumida en `app/api/whatsapp/route.ts:36-37` (con fallback a `req.nextUrl.origin` si no está seteada).
- Cron `resumen-morosos` revisado: usa `dynamic = 'force-dynamic'`, sin globals mutables ni filesystem → serverless-safe.
- `README-DEPLOY.md` con guía manual de 9 secciones (cuenta Vercel, push a GitHub, import, env vars, deploy, dominio, cron, checklist post-deploy).

### Sprint 6 — Tests + CI (commits `31b1356`, `f4976af`)
- Instalado: `vitest`, `@vitest/ui`, `jsdom`, `@testing-library/react`.
- `vitest.config.ts` con alias `@/` y env `jsdom`.
- `lib/__tests__/rut.test.ts` (13 casos): normalización, formato, validación con DV, round-trip de 24 RUTs sintéticos generados con `calcDv`.
- `lib/__tests__/movimientos.test.ts` (9 casos): estados (inactivo/al_día/pendiente/moroso), `calcularDashboard` con fixtures, **dos tests específicos del fix de timezone** (ingreso `2024-08-01` y `2024-08-31` no se corren al mes anterior/siguiente).
- Scripts en `package.json`: `test`, `test:watch`, `test:ui`.
- `.github/workflows/ci.yml`: trigger en push/PR a `main`, Node 20 con cache npm, jobs `npm ci --legacy-peer-deps` → `tsc --noEmit` → `npm test` → `npm run build`. Env vars dummy para que el build pase sin contactar Supabase.
- **Lint omitido en CI**: `next lint` fue removido en Next 16. Pendiente decidir si configurar `eslint` v9 + `eslint-config-next` con flat config.

### Sprint 7 — Producción en Vercel (commits `c92ee9b`, `50d237b`, `09a4451`)
- Repo creado en GitHub: `carlosmundacafuenzalida-hue/clubpm-kayak`, push de los commits del Sprint 6 a `origin/main`.
- Proyecto importado en Vercel y deploy verde: `https://clubpm-kayak.vercel.app`.
- Login end-to-end OK (RUT + PIN del admin → dashboard con datos reales).
- Variables de entorno cargadas en Vercel: 4 críticas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_ADMIN_RUT`, `SESSION_SECRET`) + 3 opcionales (`NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `ADMIN_TELEFONO`).
- Cron `resumen-morosos` se dispara **manualmente** vía curl con el `CRON_SECRET` (no hay scheduler en `vercel.json` aún — opción C en el roadmap).
- **Fix middleware (`50d237b`):** `/api/cron` agregado a la lista `PUBLIC` en `middleware.ts`. Antes el middleware redirigía a `/login` antes de que el route handler pudiera validar el header `Authorization`.
- **Fix mensaje cron (`09a4451`):** el resumen mostraba `desde {último mes adeudado}` cuando lo correcto era `desde {primer mes adeudado}`. Cambio en `app/api/cron/resumen-morosos/route.ts:44` de `[length-1]` a `[0]`.
- Verificación end-to-end: 24 morosos detectados, total $2.163.000, `admin_url` apuntando a `wa.me/56977779177` con el mensaje pre-cargado, recibido en WhatsApp del admin.

---

## 5. Reglas críticas del proyecto (no inventar paralelas)

Estas reglas las define `CLAUDE.md`; aquí solo las recordamos para que no se pierdan al pasar de sprint:

1. **RUT canónico** = `12345678-9` (sin puntos, con guion, dv minúscula). Toda normalización pasa por `lib/rut.ts`.
2. **Fechas DATE de Supabase**: NUNCA `new Date('2024-08-01')` solo. SIEMPRE `new Date('2024-08-01' + 'T12:00:00')` para evitar que la zona Chile (UTC-3) tire la fecha al día anterior. Ver tests en `lib/__tests__/movimientos.test.ts` que cubren esto.
3. **Estado de socio** se calcula en runtime en `calcularEstado()`. No replicar la lógica en otros lados.
4. **Sesión obligatoria en `/api/*`**: `const session = await getSession(); if (!session?.es_admin) return 401;`.
5. **No exponer service_role key** en frontend; solo `NEXT_PUBLIC_SUPABASE_ANON_KEY` (formato `sb_publishable_...`).
6. **Antes de commit**: `npx tsc --noEmit && npm run build && npm test`. Si los tres pasan, está listo.
7. **`npm install --legacy-peer-deps`** siempre (React 19 / Next 16 tienen peer deps estrictas).

---

## 6. Próximos pasos (orden sugerido)

1. **Lint en CI** — decidir si configurar `eslint` v9 + flat config con `eslint-config-next`, o seguir sin lint.
2. **Cron automático en Vercel** (opcional) — si más adelante quieres que el resumen de morosos se dispare solo, agregar sección `crons` en `vercel.json` con `path: /api/cron/resumen-morosos`. Hoy se invoca manual.
3. **Plantillas WhatsApp editables** — 5 plantillas (cobranza, recordatorio, anuncio, bienvenida, confirmación de pago) con variables `{nombre}`, `{monto_total}`, etc. Editables desde `/plantillas` sin redeploy.
4. **Dashboard de pagos intuitivo** — vista grilla matriz socios×meses + vista por socio con timeline, click en celda para registrar pago, filtros rápidos por período, gráfico de recaudación histórica.
5. **Backup/restore JSON** — descargar y restaurar todo el estado del sistema desde `/backup`. Recomendado antes de cambios riesgosos (ej. importar masivo, ajustes manuales).
6. **Excepciones de cuota por socio** — nueva tabla `excepciones_cuota` para excluir meses específicos del cálculo de morosidad: ingreso tardío, licencia, lesión, beca, otro. Gestionables desde `/socios/[id]`. Implica modificar `calcularEstado()` para honrar las excepciones.
7. **Editar/eliminar cuotas en `/configuracion`** — corrección de montos mal cargados, eliminación segura (bloqueada si hay pagos asociados).
8. **Cron real de notificaciones** — hoy `resumen-morosos` solo arma el mensaje al admin. Falta evaluar enviar mensajes individuales a socios automáticamente (requiere API oficial de WhatsApp Business o seguir con `wa.me` manual).
9. **Tests de componentes React** — la infra ya está (jsdom + testing-library). Pendiente cubrir `RutInput`, `PinInput`, formulario de pago.
10. **RLS en Supabase** — revisar que todas las tablas tengan policies. Hoy la auth pasa por la cookie del middleware, pero conviene defensa en profundidad.

---

## 7. Cómo mantener este archivo

- **Cuándo actualizar:** al cerrar un sprint o un incremento de funcionalidad notorio (no por cada commit).
- **Qué actualizar:** la fecha de cabecera, la tabla de la §1, agregar una sección nueva en §4 (sprint nuevo), y refrescar §6 si cambian las prioridades.
- **Estilo:** breve, factual, con paths y nombres de funciones reales. No describir lo que se va a hacer en futuro lejano (eso vive en §6 o en el backlog).
