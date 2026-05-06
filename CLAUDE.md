# Club PM Kayak — Plataforma de gestión

Aplicación interna del Club PM Kayak para que el tesorero administre socios, cuotas mensuales y movimientos financieros del club.

## Stack técnico

- **Framework:** Next.js 16 (App Router, Server Components, Turbopack en dev)
- **Lenguaje:** TypeScript strict
- **Base de datos:** Supabase (PostgreSQL gestionado) — proyecto `klwozyqryqndwzysetcj`
- **Estilos:** Tailwind CSS v3 con paleta custom del club (verde bosque, amarillo kayak, azul río)
- **Tipografía:** Fraunces (display, italic) + Geist (sans) + Geist Mono — vía next/font/google
- **Auth:** RUT + PIN de 4 dígitos validado contra función SQL `verify_pin`. Sesión en JWT firmado con `jose` y guardado en cookie httpOnly `clubpm_session`.
- **Sin Supabase Auth** — no usar `supabase.auth.*`. La autenticación es propia.

## Convenciones críticas del proyecto

### RUT chileno
- **Formato canónico en BD:** `12345678-9` (sin puntos, con guion, dv minúscula si es 'k')
- Toda la normalización vive en `lib/rut.ts` — usar `normalizeRut()` antes de guardar y `formatRut()` solo para mostrar
- `verify_pin` espera el RUT en formato canónico

### Fechas y timezone
- Las fechas en BD son `DATE` (ej: `'2024-08-01'`)
- **NUNCA** hacer `new Date('2024-08-01')` — JavaScript lo interpreta como UTC y en Chile (UTC-3) tira al día anterior
- **SIEMPRE** usar `new Date('2024-08-01' + 'T12:00:00')` para forzar mediodía local
- Esta regla aplica en `lib/movimientos.ts`, vistas de socio, dashboard, todo lo que parsee fechas de Supabase

### Estados de socio (calculados en runtime, no almacenados)
- `al_dia` — pagó la cuota del mes actual
- `pendiente` — está al día con meses anteriores pero aún no paga el actual
- `moroso` — tiene 1+ meses pasados sin pago
- `inactivo` — `socios.activo = false`
- `becado` — reservado, aún no implementado

La lógica vive en `calcularEstado()` de `lib/movimientos.ts`. **Modificar ahí** si cambian las reglas, no inventar cálculos paralelos.

### Capa de datos
- **Server Components:** usar `createSupabaseServer()` de `lib/supabase.ts` (lee cookies)
- **Route Handlers (`/api/*`):** mismo cliente, validar siempre `getSession()` antes de hacer queries
- **Client Components:** evitar conectar directo a Supabase. Mejor pasar datos desde Server Components o llamar a `/api/*`
- **Nunca** exponer `service_role` key en frontend. Solo se usa la `NEXT_PUBLIC_SUPABASE_ANON_KEY` (formato `sb_publishable_...`)

## Estructura del proyecto

```
app/
├── api/                 ← endpoints REST que hablan con Supabase
│   ├── login/           ← POST: valida con verify_pin, crea cookie de sesión
│   ├── logout/
│   ├── socios/          ← GET (lista), POST (crear)
│   ├── movimientos/     ← GET, POST (registrar pago)
│   └── whatsapp/        ← POST: arma link wa.me con mensaje pre-cargado
├── login/page.tsx
├── dashboard/           ← Server Component carga datos, Client Component renderiza
├── socios/
│   ├── page.tsx         ← listado
│   └── [id]/page.tsx    ← detalle individual
├── movimientos/         ← listado + modal de registro
├── layout.tsx
└── globals.css

components/
├── brand.tsx            ← BrandMark (símbolo SVG simplificado), BrandWordmark
├── navbar.tsx           ← header con links + logout
├── rut-input.tsx        ← input de RUT con validación en vivo
└── pin-input.tsx        ← 4 inputs de 1 dígito con auto-focus

lib/
├── supabase.ts          ← clientes server/browser + tipos Socio, Movimiento, CuotaConfig
├── rut.ts               ← validar/normalizar/formatear RUT chileno
├── session.ts           ← createSession, getSession, destroySession (JWT en cookie)
└── movimientos.ts       ← calcularEstado, calcularDashboard, formatCLP, formatMes

middleware.ts            ← redirige a /login si no hay cookie válida
```

## Schema de Supabase

### Tabla `socios`
- `id` uuid PK, `rut` text unique, `nombre` text, `telefono` text, `fecha_ingreso` date, `activo` bool, `es_admin` bool, `pin_hash` text

### Tabla `cuotas_config`
- `id` uuid PK, `mes` date unique (formato `'YYYY-MM-01'`), `monto` numeric

### Tabla `movimientos`
- `id` uuid PK, `tipo` enum (`pago_cuota`, `pago_extra`, `cargo`, `ajuste`), `fecha_registro` date, `socio_id` uuid FK, `mes_cuota` date nullable, `monto` numeric, `glosa` text, `comprobante_url` text nullable, `creado_en` timestamptz, `creado_por` text

### Función `verify_pin(p_rut text, p_pin text) returns boolean`
- `SECURITY DEFINER` — compara hash SHA256 del PIN ingresado contra `socios.pin_hash` para socios con `es_admin=true` y `activo=true`

### Storage bucket `comprobantes`
- Privado (no público). Usar para subir fotos/PDFs de pagos. Aún no hay UI implementada.

## Variables de entorno (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://klwozyqryqndwzysetcj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
NEXT_PUBLIC_ADMIN_RUT=17353638-0
SESSION_SECRET=<32+ chars random>
```

## Comandos del proyecto

- `npm run dev` — servidor en http://localhost:3000 con hot reload
- `npm run build` — build de producción
- `npm run lint` — ESLint
- `npx tsc --noEmit` — typecheck sin generar archivos

## Estado actual y próximos pasos

**Completado (Fase 1 + parche):**
- Schema SQL + función verify_pin en Supabase
- Auth con RUT + PIN
- Dashboard con métricas en vivo (socios activos, pagos del mes, morosos, recaudado)
- Listado de socios con búsqueda y filtros
- Detalle de socio con historial completo
- Registro de pagos desde UI
- Botón WhatsApp con mensaje pre-cargado para morosos
- Carga histórica de 218 pagos importados desde Excel
- Fix de timezone aplicado en lib/movimientos.ts y app/socios/[id]/page.tsx

**Por hacer (Fase 2 - 3, ver PLAN.md):**
- Configuración de monto de cuota desde UI (hoy es SQL puro)
- Subida de comprobantes al bucket Supabase Storage
- Reportes Excel exportables (deudores, recaudación mensual)
- Importación masiva de socios desde Excel
- Notificaciones automatizadas (cron + WhatsApp)
- Deploy a Vercel
- Tests + CI con GitHub Actions
- **Plantillas WhatsApp editables + envío masivo** (5 plantillas: cobranza, recordatorio, anuncio, bienvenida, confirmación de pago, todas con variables `{nombre}`, `{monto_total}`, etc., editables sin redeploy desde `/plantillas`)
- **Dashboard de pagos intuitivo** (vista grilla matriz socios×meses + vista por socio con timeline, click en celda para registrar pago, filtros rápidos por período, gráfico de recaudación histórica)
- **Backup/restore JSON** (descargar y restaurar todo el estado del sistema desde `/backup`, recomendado antes de cambios riesgosos)
- **Excepciones de cuota por socio** (tabla `excepciones_cuota` para excluir meses específicos del cálculo de morosidad: ingreso tardío, licencia, lesión, beca, otro — gestionables desde `/socios/[id]`)
- **Editar/eliminar cuotas en /configuracion** (corrección de montos mal cargados, eliminación segura — bloqueada si hay pagos asociados)

## Reglas para Claude Code

1. **Lee este archivo primero.** Define el contexto completo del proyecto.
2. **Antes de tocar lógica de fechas**, recordar la regla del `T12:00:00`. Si dudas, agregar test en `lib/__tests__/`.
3. **Antes de tocar la BD**, verificar el schema con `select column_name, data_type from information_schema.columns where table_name = 'X'`.
4. **Validar sesión en TODOS los endpoints `/api/*`**. Patrón: `const session = await getSession(); if (!session?.es_admin) return 401;`
5. **No reproducir lógica de cálculo de estado en otros lados** — usar `calcularEstado()` siempre.
6. **Si agregas tablas nuevas**, habilitar RLS y crear policies.
7. **Si agregas dependencias**, usar `npm install --legacy-peer-deps` (React 19 / Next 16 tienen peer deps estrictas).
8. **Antes de hacer commit**, correr `npx tsc --noEmit && npm run build`. Si pasan los dos, está listo.
9. **No eliminar el bucket `comprobantes`** ni cambiar el nombre — está hardcodeado en código futuro.
10. **Mantener la paleta del club** — los colores están en `tailwind.config.ts`. Si hay duda visual, abrir `/login` para ver la cita "El río no apura, pero siempre llega" y respetar esa estética.
