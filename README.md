# Club PM Kayak — Plataforma de gestión

Aplicación interna del Club PM Kayak para administrar socios, cuotas y movimientos. Construida con **Next.js 15** + **Supabase** + **Tailwind CSS**.

---

## 🚀 Cómo arrancar el proyecto

Esta carpeta contiene todo el código de la app. Para correrla en tu computador:

### 1. Reemplaza tu proyecto actual

Tienes dos opciones:

**Opción A — Reemplazar todo (recomendado si tu proyecto actual está vacío):**

```bash
# Respalda tu .env.local actual primero
cp C:/Proyectos/club-cuotas/.env.local C:/Proyectos/club-cuotas/.env.local.bak

# Borra el contenido del proyecto actual (excepto .env.local y la carpeta supabase/)
# Luego copia todos los archivos de este zip dentro de C:/Proyectos/club-cuotas/

# Restaura tu .env.local
cp C:/Proyectos/club-cuotas/.env.local.bak C:/Proyectos/club-cuotas/.env.local
```

**Opción B — Empezar fresco:**

```bash
# Mueve la carpeta actual a un backup
mv C:/Proyectos/club-cuotas C:/Proyectos/club-cuotas-old

# Copia este zip descomprimido como nueva carpeta
# (asegúrate de copiar también supabase/migrations/ desde el backup)
```

### 2. Variables de entorno

Tu `.env.local` debe tener estas 4 variables (las mismas que ya configuraste):

```
NEXT_PUBLIC_SUPABASE_URL=https://klwozyqryqndwzysetcj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_KqczDOakujUb4YO3ijROOQ_sjabNX-0
NEXT_PUBLIC_ADMIN_RUT=17353638-0
SESSION_SECRET=xqDZV+KaqjQeMbMTs59f...
```

Si necesitas un ejemplo, ver `.env.local.example`.

### 3. Instalar dependencias

```bash
cd C:/Proyectos/club-cuotas
npm install
```

Esto descargará Next.js, Supabase, jose (para JWT), Tailwind y todas las demás dependencias. Tarda ~1-2 minutos.

### 4. Levantar el servidor

```bash
npm run dev
```

Abre <http://localhost:3000> en tu navegador. Te debería redirigir al login.

### 5. Iniciar sesión

Usa las credenciales del tesorero que insertaste en la Tarea 4:

- **RUT:** `17.353.638-0` (o como lo tengas formateado)
- **PIN:** el que elegiste cuando hiciste el `INSERT` (o el que cambiaste con el `UPDATE`)

---

## 📁 Estructura del proyecto

```
club-cuotas/
├── app/
│   ├── api/               ← Endpoints REST que hablan con Supabase
│   │   ├── login/         ← POST /api/login (valida con verify_pin)
│   │   ├── logout/        ← POST /api/logout
│   │   ├── socios/        ← GET (lista) + POST (crear)
│   │   ├── movimientos/   ← GET + POST (registrar pago)
│   │   └── whatsapp/      ← POST (genera link wa.me con mensaje)
│   ├── login/             ← Página de login con RUT + PIN
│   ├── dashboard/         ← Pantalla principal con métricas y morosos
│   ├── socios/
│   │   ├── page.tsx       ← Listado con búsqueda y filtros
│   │   └── [id]/page.tsx  ← Detalle individual con historial
│   ├── movimientos/       ← Registro de pagos y listado
│   ├── layout.tsx         ← Layout raíz con fuentes (Fraunces, Geist)
│   ├── globals.css        ← Estilos base + componentes Tailwind
│   └── page.tsx           ← Redirige a /dashboard o /login según sesión
├── components/
│   ├── brand.tsx          ← Logo simbólico (BrandMark) + wordmark
│   ├── navbar.tsx         ← Barra de navegación superior
│   ├── rut-input.tsx      ← Input de RUT con validación en vivo
│   └── pin-input.tsx      ← Input de PIN de 4 dígitos
├── lib/
│   ├── supabase.ts        ← Clientes Supabase (server + browser)
│   ├── rut.ts             ← Validar y formatear RUT chileno
│   ├── session.ts         ← JWT firmado en cookie httpOnly
│   └── movimientos.ts     ← Lógica de cálculo de estado y morosidad
├── public/
│   └── logo.png           ← Logo del club (con fondo transparente)
├── middleware.ts          ← Protege rutas privadas (redirige a /login)
├── tailwind.config.ts     ← Paleta de colores del Club PM Kayak
├── tsconfig.json
├── next.config.js
├── postcss.config.js
└── package.json
```

---

## 🎨 Paleta de colores

Todos los colores están extraídos del logo del club y disponibles como clases de Tailwind:

| Clase Tailwind        | Hex       | Uso                                |
|-----------------------|-----------|-------------------------------------|
| `bg-bosque`           | `#0D3D20` | Navbar, fondos oscuros              |
| `bg-verde`            | `#1D6B3A` | Botones primarios, "al día"         |
| `bg-pradera`          | `#5CAA6F` | Hover sutil                         |
| `bg-rio`              | `#2E86AB` | Información, links                  |
| `bg-aguas`            | `#A8D8E8` | Fondos suaves                       |
| `bg-kayak`            | `#F5C842` | Acento de marca, CTA destacado      |
| `bg-roca`             | `#8B6F47` | Neutros                             |
| `bg-rojo`             | `#C0392B` | Morosos, alertas                    |
| `bg-paper`            | `#FAF8F3` | Fondo de página                     |

---

## 🔌 Cómo se conecta a Supabase

La app usa **dos patrones** para hablar con la base:

1. **Server Components** (las páginas): leen datos directamente al renderizar.
   Ejemplo en `app/dashboard/page.tsx`:
   ```ts
   const supabase = await createSupabaseServer();
   const { data } = await supabase.from('socios').select('*');
   ```

2. **Route Handlers** (los `app/api/*/route.ts`): aceptan POSTs desde el cliente
   y escriben/modifican datos. Validan sesión antes de cada operación.

La autenticación NO usa Supabase Auth — usa la función `verify_pin` que creaste
en la Tarea 5 + un JWT firmado localmente con `SESSION_SECRET` que se guarda en
una cookie httpOnly.

### Flujo de login en detalle

1. Usuario ingresa RUT + PIN en `/login`
2. Frontend hace POST a `/api/login` con `{ rut, pin }`
3. El endpoint llama a `supabase.rpc('verify_pin', { p_rut, p_pin })`
4. Si la función SQL devuelve `true`, recupera el socio de la tabla
5. Firma un JWT con `socio_id`, `rut`, `nombre`, `es_admin`
6. Guarda el JWT en una cookie `clubpm_session` (httpOnly, secure)
7. El middleware (`middleware.ts`) revisa esta cookie en cada request

---

## 📱 Funcionalidades incluidas (Fase 2)

- ✅ Login con RUT + PIN validado contra `verify_pin` en Supabase
- ✅ Dashboard con métricas reales: socios activos, pagos del mes, morosos, recaudación
- ✅ Cálculo automático de morosidad por meses adeudados
- ✅ Donut chart con distribución de estados
- ✅ Feed de actividad reciente (últimos 5 movimientos)
- ✅ Listado de socios con búsqueda y filtros por estado
- ✅ Detalle de socio con historial completo de movimientos
- ✅ Crear socios nuevos desde la app
- ✅ Registrar pagos de cuotas (con auto-completado de monto desde `cuotas_config`)
- ✅ Botón de WhatsApp que abre wa.me con mensaje de cobro pre-cargado
- ✅ Sesión segura con JWT firmado y cookie httpOnly
- ✅ Middleware que protege todas las rutas privadas

## 🚧 Pendientes para la Fase 3

- [ ] Reportes Excel exportables
- [ ] Subir comprobantes de pago al bucket `comprobantes` de Supabase Storage
- [ ] Configuración de monto de cuota desde la UI
- [ ] Importación masiva de socios desde Excel
- [ ] Deploy a Vercel

---

## 🐛 Resolución de problemas

**"Error: SESSION_SECRET no está definido"**
→ Verifica que tu `.env.local` esté en la raíz del proyecto y tenga la variable.

**"RUT o PIN incorrectos" pero los datos son correctos**
→ Asegúrate de que el RUT en la tabla `socios` esté en formato `12345678-9` (sin puntos, con guion). La app envía el RUT normalizado a `verify_pin`.

**El dashboard se ve vacío (0 socios, 0 morosos)**
→ Verifica en el SQL Editor de Supabase que la tabla `socios` tenga datos:
```sql
select count(*) from socios;
```

**"No autorizado" en endpoints**
→ Cierra sesión y vuelve a entrar. Tu cookie puede haber expirado.

---

Construido con cariño para el Club PM Kayak 🛶
