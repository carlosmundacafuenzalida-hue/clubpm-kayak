# Club Cuotas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Web app para control de pago de cuotas de club de 27 socios, con vista de socio por RUT y panel de tesorero completo.

**Architecture:** Next.js App Router con Supabase como backend (PostgreSQL + Storage). Autenticación propia por RUT (socios) y RUT+PIN (tesorero). Deploy en Vercel.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, Supabase (supabase-js), Vitest, xlsx (exportación Excel), openpyxl (script importación)

---

## Mapa de archivos

```
club-cuotas/
├── app/
│   ├── layout.tsx                  # Root layout con providers
│   ├── page.tsx                    # Redirect a /login
│   ├── login/page.tsx              # Login por RUT (± PIN)
│   ├── socio/page.tsx              # Vista socio (solo lectura)
│   └── admin/
│       ├── layout.tsx              # Guard: solo admins
│       ├── page.tsx                # Dashboard
│       ├── socios/page.tsx         # Gestión socios
│       ├── movimientos/page.tsx    # Lista + formulario movimientos
│       ├── reportes/page.tsx       # Exportar Excel
│       └── configuracion/page.tsx  # Monto cuota por mes
├── lib/
│   ├── supabase.ts                 # Cliente Supabase + tipos
│   ├── rut.ts                      # Normalizar, validar RUT chileno
│   ├── session.ts                  # Leer/escribir sesión en cookie
│   ├── movimientos.ts              # CRUD movimientos + cálculo estado
│   └── excel.ts                    # Exportación a .xlsx
├── components/
│   ├── RutInput.tsx                # Input con normalización automática
│   ├── EstadoBadge.tsx             # Semáforo ✅⚠️🔴
│   ├── MovimientoForm.tsx          # Formulario nuevo/editar movimiento
│   └── TablaMovimientos.tsx        # Tabla filtrable de movimientos
├── scripts/
│   └── import_planilla.py          # Importar Excel histórico a Supabase
├── supabase/migrations/
│   └── 001_initial.sql             # Schema completo
├── __tests__/
│   ├── rut.test.ts
│   └── movimientos.test.ts
├── .env.local.example
└── package.json
```

---

## FASE 1 — Core

---

### Task 1: Inicializar proyecto Next.js

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `.env.local.example`

- [ ] **Step 1: Crear proyecto**

```bash
cd C:/Proyectos
npx create-next-app@latest club-cuotas \
  --typescript --tailwind --eslint \
  --app --src-dir=no --import-alias="@/*"
cd club-cuotas
```

- [ ] **Step 2: Instalar dependencias**

```bash
npm install @supabase/supabase-js xlsx
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Configurar Vitest — crear `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

- [ ] **Step 4: Crear `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Agregar scripts a `package.json`**

Editar la sección `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Crear `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_ADMIN_RUT=12345678-9
SESSION_SECRET=cambia-esto-por-string-random-32-chars
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: init Next.js + Supabase + Vitest"
```

---

### Task 2: Schema de base de datos en Supabase

**Files:**
- Create: `supabase/migrations/001_initial.sql`

- [ ] **Step 1: Crear el archivo de migración**

```sql
-- supabase/migrations/001_initial.sql

create extension if not exists "pgcrypto";

-- Socios
create table socios (
  id          uuid primary key default gen_random_uuid(),
  rut         text unique not null,
  nombre      text not null,
  telefono    text,
  fecha_ingreso date not null,
  activo      boolean not null default true,
  es_admin    boolean not null default false,
  pin_hash    text
);

-- Configuración de cuotas por mes
create table cuotas_config (
  id     uuid primary key default gen_random_uuid(),
  mes    date unique not null,   -- siempre primer día del mes
  monto  numeric(10,2) not null
);

-- Tipo de movimiento
create type tipo_movimiento as enum ('pago_cuota', 'ingreso_extra', 'gasto');

-- Movimientos (pagos, ingresos, gastos)
create table movimientos (
  id              uuid primary key default gen_random_uuid(),
  tipo            tipo_movimiento not null,
  fecha_registro  date not null,
  socio_id        uuid references socios(id),
  mes_cuota       date,          -- solo para pago_cuota
  monto           numeric(10,2) not null,
  glosa           text not null,
  comprobante_url text,
  creado_en       timestamptz not null default now(),
  creado_por      text not null  -- RUT del tesorero
);

-- RLS: acceso público de lectura a socios y movimientos (se filtra en app)
alter table socios enable row level security;
alter table cuotas_config enable row level security;
alter table movimientos enable row level security;

create policy "public_read_socios" on socios for select using (true);
create policy "public_read_cuotas" on cuotas_config for select using (true);
create policy "public_read_movimientos" on movimientos for select using (true);
create policy "public_insert_movimientos" on movimientos for insert with check (true);
create policy "public_update_movimientos" on movimientos for update using (true);
create policy "public_insert_socios" on socios for insert with check (true);
create policy "public_update_socios" on socios for update using (true);
create policy "public_insert_cuotas" on cuotas_config for insert with check (true);
create policy "public_update_cuotas" on cuotas_config for update using (true);
```

- [ ] **Step 2: Ejecutar en Supabase**

En el dashboard de Supabase → SQL Editor → pegar y ejecutar el contenido completo del archivo.

- [ ] **Step 3: Crear bucket para comprobantes**

En Supabase → Storage → New bucket → nombre: `comprobantes` → Public: NO (archivos privados, acceso por URL firmada).

- [ ] **Step 4: Insertar tesorero inicial**

Reemplaza `TU_RUT` (ej: `12345678-9`) y `TU_PIN` (ej: `1234`):

```sql
insert into socios (rut, nombre, telefono, fecha_ingreso, es_admin, pin_hash)
values (
  'TU_RUT',
  'Nombre Tesorero',
  '56912345678',
  '2024-08-01',
  true,
  encode(digest('TU_PIN', 'sha256'), 'hex')
);
```

- [ ] **Step 5: Commit**

```bash
git add supabase/
git commit -m "feat: Supabase schema y migración inicial"
```

---

### Task 3: Utilidad RUT (`lib/rut.ts`)

**Files:**
- Create: `lib/rut.ts`
- Test: `__tests__/rut.test.ts`

- [ ] **Step 1: Escribir tests fallidos**

```typescript
// __tests__/rut.test.ts
import { describe, it, expect } from 'vitest'
import { normalizeRut, validateRut } from '@/lib/rut'

describe('normalizeRut', () => {
  it('elimina puntos y conserva guión', () => {
    expect(normalizeRut('12.345.678-9')).toBe('12345678-9')
  })
  it('agrega guión si falta', () => {
    expect(normalizeRut('123456789')).toBe('12345678-9')
  })
  it('maneja K mayúscula en dígito verificador', () => {
    expect(normalizeRut('76354771k')).toBe('76354771-k')
  })
  it('devuelve vacío para entrada vacía', () => {
    expect(normalizeRut('')).toBe('')
  })
})

describe('validateRut', () => {
  it('valida RUT correcto', () => {
    expect(validateRut('12345678-9')).toBe(false) // dígito inválido
    expect(validateRut('76354771-k')).toBe(true)
  })
  it('rechaza RUT malformado', () => {
    expect(validateRut('abc')).toBe(false)
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

```bash
npm test -- rut
```
Expected: FAIL `Cannot find module '@/lib/rut'`

- [ ] **Step 3: Implementar `lib/rut.ts`**

```typescript
export function normalizeRut(raw: string): string {
  if (!raw) return ''
  const clean = raw.replace(/\./g, '').replace(/-/g, '').toLowerCase()
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  return `${body}-${dv}`
}

export function validateRut(rut: string): boolean {
  const normalized = normalizeRut(rut)
  const match = normalized.match(/^(\d+)-([0-9k])$/)
  if (!match) return false
  const [, body, dv] = match
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const remainder = 11 - (sum % 11)
  const expected = remainder === 11 ? '0' : remainder === 10 ? 'k' : String(remainder)
  return dv === expected
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

```bash
npm test -- rut
```
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/rut.ts __tests__/rut.test.ts
git commit -m "feat: utilidad normalización y validación RUT"
```

---

### Task 4: Cliente Supabase y tipos (`lib/supabase.ts`)

**Files:**
- Create: `lib/supabase.ts`

- [ ] **Step 1: Crear `.env.local` desde el ejemplo**

```bash
cp .env.local.example .env.local
# Luego edita .env.local con tus valores reales de Supabase
```

- [ ] **Step 2: Crear `lib/supabase.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'

export type TipoMovimiento = 'pago_cuota' | 'ingreso_extra' | 'gasto'

export interface Socio {
  id: string
  rut: string
  nombre: string
  telefono: string | null
  fecha_ingreso: string
  activo: boolean
  es_admin: boolean
  pin_hash: string | null
}

export interface CuotaConfig {
  id: string
  mes: string   // 'YYYY-MM-DD' (siempre día 1)
  monto: number
}

export interface Movimiento {
  id: string
  tipo: TipoMovimiento
  fecha_registro: string
  socio_id: string | null
  mes_cuota: string | null
  monto: number
  glosa: string
  comprobante_url: string | null
  creado_en: string
  creado_por: string
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts .env.local.example
git commit -m "feat: cliente Supabase y tipos compartidos"
```

---

### Task 5: Sesión y autenticación (`lib/session.ts`)

**Files:**
- Create: `lib/session.ts`

La sesión se guarda en una cookie de navegador (no en Supabase Auth) para evitar configurar correo/OAuth.

- [ ] **Step 1: Crear `lib/session.ts`**

```typescript
export interface SessionData {
  rut: string
  nombre: string
  esAdmin: boolean
}

const SESSION_KEY = 'club_session'

export function saveSession(data: SessionData): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

export function getSession(): SessionData | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionData
  } catch {
    return null
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_KEY)
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/session.ts
git commit -m "feat: manejo de sesión en sessionStorage"
```

---

### Task 6: Lógica de movimientos y estado de socio (`lib/movimientos.ts`)

**Files:**
- Create: `lib/movimientos.ts`
- Test: `__tests__/movimientos.test.ts`

- [ ] **Step 1: Escribir tests fallidos**

```typescript
// __tests__/movimientos.test.ts
import { describe, it, expect } from 'vitest'
import { calcularEstadoMes, calcularEstadoGeneral, generarMesesDesdeInicio } from '@/lib/movimientos'

describe('calcularEstadoMes', () => {
  it('al día cuando pagado >= monto', () => {
    expect(calcularEstadoMes(15000, 15000)).toBe('al_dia')
    expect(calcularEstadoMes(20000, 15000)).toBe('al_dia')
  })
  it('deuda parcial cuando 0 < pagado < monto', () => {
    expect(calcularEstadoMes(5000, 15000)).toBe('parcial')
  })
  it('impago cuando pagado = 0', () => {
    expect(calcularEstadoMes(0, 15000)).toBe('impago')
  })
})

describe('generarMesesDesdeInicio', () => {
  it('genera lista de meses desde ago 2024 hasta fecha dada', () => {
    const meses = generarMesesDesdeInicio(new Date('2024-10-01'))
    expect(meses[0]).toBe('2024-08-01')
    expect(meses[meses.length - 1]).toBe('2024-10-01')
    expect(meses.length).toBe(3)
  })
})

describe('calcularEstadoGeneral', () => {
  it('al día si todos los meses están al día', () => {
    expect(calcularEstadoGeneral(['al_dia', 'al_dia'])).toBe('al_dia')
  })
  it('moroso si algún mes tiene impago', () => {
    expect(calcularEstadoGeneral(['al_dia', 'impago'])).toBe('moroso')
  })
  it('parcial si hay deuda pero no impago completo', () => {
    expect(calcularEstadoGeneral(['al_dia', 'parcial'])).toBe('parcial')
  })
})
```

- [ ] **Step 2: Ejecutar — debe fallar**

```bash
npm test -- movimientos
```
Expected: FAIL

- [ ] **Step 3: Implementar `lib/movimientos.ts`**

```typescript
import { supabase, type Movimiento, type CuotaConfig } from './supabase'

export type EstadoMes = 'al_dia' | 'parcial' | 'impago'
export type EstadoGeneral = 'al_dia' | 'parcial' | 'moroso'

export const INICIO_CUOTAS = '2024-08-01'

export function calcularEstadoMes(pagado: number, esperado: number): EstadoMes {
  if (pagado >= esperado) return 'al_dia'
  if (pagado > 0) return 'parcial'
  return 'impago'
}

export function calcularEstadoGeneral(estados: EstadoMes[]): EstadoGeneral {
  if (estados.every(e => e === 'al_dia')) return 'al_dia'
  if (estados.some(e => e === 'impago')) return 'moroso'
  return 'parcial'
}

export function generarMesesDesdeInicio(hasta: Date = new Date()): string[] {
  const meses: string[] = []
  const inicio = new Date(INICIO_CUOTAS)
  const current = new Date(inicio)
  current.setDate(1)
  const limite = new Date(hasta)
  limite.setDate(1)
  while (current <= limite) {
    meses.push(current.toISOString().slice(0, 10))
    current.setMonth(current.getMonth() + 1)
  }
  return meses
}

export async function getMovimientosDeSocio(socioId: string): Promise<Movimiento[]> {
  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .eq('socio_id', socioId)
    .eq('tipo', 'pago_cuota')
    .order('fecha_registro', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getCuotasConfig(): Promise<CuotaConfig[]> {
  const { data, error } = await supabase
    .from('cuotas_config')
    .select('*')
    .order('mes')
  if (error) throw error
  return data ?? []
}

export async function insertMovimiento(
  mov: Omit<Movimiento, 'id' | 'creado_en'>
): Promise<void> {
  const { error } = await supabase.from('movimientos').insert(mov)
  if (error) throw error
}

export async function updateMovimiento(
  id: string,
  patch: Partial<Omit<Movimiento, 'id' | 'creado_en'>>
): Promise<void> {
  const { error } = await supabase.from('movimientos').update(patch).eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 4: Ejecutar — debe pasar**

```bash
npm test -- movimientos
```
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/movimientos.ts __tests__/movimientos.test.ts
git commit -m "feat: lógica de cálculo de estado de socio y CRUD movimientos"
```

---

### Task 7: Componente `RutInput`

**Files:**
- Create: `components/RutInput.tsx`

- [ ] **Step 1: Crear `components/RutInput.tsx`**

```typescript
'use client'
import { normalizeRut } from '@/lib/rut'

interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function RutInput({ value, onChange, placeholder = '12.345.678-9', className }: Props) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      className={className}
      onChange={e => onChange(normalizeRut(e.target.value))}
    />
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/RutInput.tsx
git commit -m "feat: componente RutInput con normalización automática"
```

---

### Task 8: Componente `EstadoBadge`

**Files:**
- Create: `components/EstadoBadge.tsx`

- [ ] **Step 1: Crear `components/EstadoBadge.tsx`**

```typescript
import type { EstadoGeneral } from '@/lib/movimientos'

const config: Record<EstadoGeneral, { label: string; classes: string }> = {
  al_dia:  { label: '✅ Al día',        classes: 'bg-green-100 text-green-800' },
  parcial: { label: '⚠️ Deuda parcial', classes: 'bg-yellow-100 text-yellow-800' },
  moroso:  { label: '🔴 Moroso',        classes: 'bg-red-100 text-red-800' },
}

export function EstadoBadge({ estado }: { estado: EstadoGeneral }) {
  const { label, classes } = config[estado]
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${classes}`}>
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/EstadoBadge.tsx
git commit -m "feat: componente EstadoBadge semáforo"
```

---

### Task 9: Página de Login (`app/login/page.tsx`)

**Files:**
- Create: `app/login/page.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Crear `app/page.tsx` (redirect)**

```typescript
import { redirect } from 'next/navigation'
export default function Home() {
  redirect('/login')
}
```

- [ ] **Step 2: Crear `app/login/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { normalizeRut } from '@/lib/rut'
import { saveSession } from '@/lib/session'
import { RutInput } from '@/components/RutInput'

export default function LoginPage() {
  const router = useRouter()
  const [rut, setRut] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const normalized = normalizeRut(rut)

    const { data: socio, error: dbError } = await supabase
      .from('socios')
      .select('id, rut, nombre, es_admin, pin_hash, activo')
      .eq('rut', normalized)
      .single()

    if (dbError || !socio) {
      setError('RUT no registrado. Contacta al tesorero.')
      setLoading(false)
      return
    }
    if (!socio.activo) {
      setError('Este socio está dado de baja.')
      setLoading(false)
      return
    }
    if (socio.es_admin) {
      if (!showPin) { setShowPin(true); setLoading(false); return }
      // Verificar PIN vía Supabase RPC o hash local
      const { data: pinOk } = await supabase.rpc('verify_pin', { p_rut: normalized, p_pin: pin })
      if (!pinOk) {
        setError('PIN incorrecto.')
        setLoading(false)
        return
      }
    }

    saveSession({ rut: socio.rut, nombre: socio.nombre, esAdmin: socio.es_admin })
    router.push(socio.es_admin ? '/admin' : '/socio')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">Club Cuotas</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">RUT</label>
            <RutInput
              value={rut}
              onChange={setRut}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {showPin && (
            <div>
              <label className="block text-sm font-medium mb-1">PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={8}
              />
            </div>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Crear función RPC `verify_pin` en Supabase**

En Supabase → SQL Editor:
```sql
create or replace function verify_pin(p_rut text, p_pin text)
returns boolean
language sql
security definer
as $$
  select exists(
    select 1 from socios
    where rut = p_rut
      and es_admin = true
      and pin_hash = encode(digest(p_pin, 'sha256'), 'hex')
  );
$$;
```

- [ ] **Step 4: Verificar manualmente**

```bash
npm run dev
```
Abrir `http://localhost:3000/login` → ingresar RUT de un socio → debe redirigir a `/socio`. Ingresar RUT del tesorero → debe pedir PIN → redirigir a `/admin`.

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx app/page.tsx
git commit -m "feat: página login con RUT y PIN para tesorero"
```

---

### Task 10: Vista del socio (`app/socio/page.tsx`)

**Files:**
- Create: `app/socio/page.tsx`

- [ ] **Step 1: Crear `app/socio/page.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, clearSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import {
  generarMesesDesdeInicio, calcularEstadoMes, calcularEstadoGeneral,
  getCuotasConfig, getMovimientosDeSocio,
  type EstadoMes
} from '@/lib/movimientos'
import { EstadoBadge } from '@/components/EstadoBadge'

interface FilaMes {
  mes: string
  esperado: number
  pagado: number
  estado: EstadoMes
  glosa: string
  comprobante_url: string | null
}

export default function SocioPage() {
  const router = useRouter()
  const [filas, setFilas] = useState<FilaMes[]>([])
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = getSession()
    if (!session || session.esAdmin) { router.push('/login'); return }
    setNombre(session.nombre)
    cargarDatos(session.rut)
  }, [router])

  async function cargarDatos(rut: string) {
    const { data: socio } = await supabase
      .from('socios').select('id').eq('rut', rut).single()
    if (!socio) return

    const [cuotas, movimientos] = await Promise.all([
      getCuotasConfig(),
      getMovimientosDeSocio(socio.id),
    ])

    const montoMap = Object.fromEntries(cuotas.map(c => [c.mes, c.monto]))
    const meses = generarMesesDesdeInicio()

    const resultado: FilaMes[] = meses.map(mes => {
      const pagosDelMes = movimientos.filter(m => m.mes_cuota === mes)
      const pagado = pagosDelMes.reduce((s, m) => s + m.monto, 0)
      const esperado = montoMap[mes] ?? 0
      return {
        mes,
        esperado,
        pagado,
        estado: calcularEstadoMes(pagado, esperado),
        glosa: pagosDelMes.map(m => m.glosa).join(', '),
        comprobante_url: pagosDelMes.find(m => m.comprobante_url)?.comprobante_url ?? null,
      }
    })

    setFilas(resultado)
    setLoading(false)
  }

  const estadoGeneral = calcularEstadoGeneral(filas.map(f => f.estado))
  const totalDeuda = filas.reduce((s, f) => s + Math.max(0, f.esperado - f.pagado), 0)

  function formatMes(mes: string) {
    return new Date(mes + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  }

  if (loading) return <div className="p-8 text-center">Cargando...</div>

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Hola, {nombre}</h1>
        <button onClick={() => { clearSession(); router.push('/login') }}
          className="text-sm text-gray-500 hover:underline">Salir</button>
      </div>

      <div className="bg-white rounded-xl shadow p-6 flex justify-between items-center">
        <EstadoBadge estado={estadoGeneral} />
        {totalDeuda > 0 && (
          <span className="text-red-600 font-bold text-lg">
            Deuda total: ${totalDeuda.toLocaleString('es-CL')}
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Mes</th>
              <th className="px-4 py-2 text-right">Esperado</th>
              <th className="px-4 py-2 text-right">Pagado</th>
              <th className="px-4 py-2 text-center">Estado</th>
              <th className="px-4 py-2 text-left">Glosa</th>
              <th className="px-4 py-2 text-center">Comprobante</th>
            </tr>
          </thead>
          <tbody>
            {[...filas].reverse().map(fila => (
              <tr key={fila.mes} className="border-t">
                <td className="px-4 py-2 capitalize">{formatMes(fila.mes)}</td>
                <td className="px-4 py-2 text-right">${fila.esperado.toLocaleString('es-CL')}</td>
                <td className="px-4 py-2 text-right">${fila.pagado.toLocaleString('es-CL')}</td>
                <td className="px-4 py-2 text-center">
                  {fila.estado === 'al_dia' ? '✅' : fila.estado === 'parcial' ? '⚠️' : '🔴'}
                </td>
                <td className="px-4 py-2 text-gray-500">{fila.glosa}</td>
                <td className="px-4 py-2 text-center">
                  {fila.comprobante_url && (
                    <a href={fila.comprobante_url} target="_blank"
                      className="text-blue-600 hover:underline">Ver</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verificar manualmente**

```bash
npm run dev
```
Login con RUT de socio → ver tabla con todos los meses desde ago 2024.

- [ ] **Step 3: Commit**

```bash
git add app/socio/page.tsx
git commit -m "feat: vista de socio con estado mes a mes"
```

---

## FASE 2 — Admin completo

---

### Task 11: Layout y guard admin (`app/admin/layout.tsx`)

**Files:**
- Create: `app/admin/layout.tsx`

- [ ] **Step 1: Crear `app/admin/layout.tsx`**

```typescript
'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getSession, clearSession } from '@/lib/session'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const session = getSession()
    if (!session?.esAdmin) router.push('/login')
  }, [router])

  const navItems = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/socios', label: 'Socios' },
    { href: '/admin/movimientos', label: 'Movimientos' },
    { href: '/admin/reportes', label: 'Reportes' },
    { href: '/admin/configuracion', label: 'Configuración' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 text-white px-6 py-3 flex gap-6 items-center">
        <span className="font-bold mr-4">Club Cuotas</span>
        {navItems.map(item => (
          <Link key={item.href} href={item.href}
            className={`text-sm hover:underline ${pathname === item.href ? 'font-bold underline' : ''}`}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => { clearSession(); router.push('/login') }}
          className="ml-auto text-sm hover:underline">Salir</button>
      </nav>
      <main className="max-w-5xl mx-auto p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/admin/layout.tsx
git commit -m "feat: layout admin con navegación y guard de sesión"
```

---

### Task 12: Dashboard admin (`app/admin/page.tsx`)

**Files:**
- Create: `app/admin/page.tsx`

- [ ] **Step 1: Crear `app/admin/page.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCuotasConfig, getMovimientosDeSocio, calcularEstadoMes, generarMesesDesdeInicio } from '@/lib/movimientos'

interface ResumenMes {
  recaudado: number
  esperado: number
  sociosAlDia: number
  totalSocios: number
  morosos: { nombre: string; deuda: number }[]
  ultimosMovimientos: { fecha: string; glosa: string; monto: number; tipo: string }[]
}

export default function DashboardPage() {
  const [resumen, setResumen] = useState<ResumenMes | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const mesActual = new Date()
    mesActual.setDate(1)
    const mesKey = mesActual.toISOString().slice(0, 10)

    const [{ data: socios }, cuotas, { data: movimientos }] = await Promise.all([
      supabase.from('socios').select('id, nombre').eq('activo', true),
      getCuotasConfig(),
      supabase.from('movimientos').select('*').order('creado_en', { ascending: false }).limit(10),
    ])

    const montoMesActual = cuotas.find(c => c.mes === mesKey)?.monto ?? 0
    const meses = generarMesesDesdeInicio()

    let recaudado = 0
    let sociosAlDia = 0
    const morosos: { nombre: string; deuda: number }[] = []

    for (const socio of socios ?? []) {
      const pagos = await getMovimientosDeSocio(socio.id)
      const pagosMes = pagos.filter(p => p.mes_cuota === mesKey)
      const pagadoMes = pagosMes.reduce((s, p) => s + p.monto, 0)
      recaudado += pagadoMes

      const montoMap = Object.fromEntries(cuotas.map(c => [c.mes, c.monto]))
      let deudaTotal = 0
      let alDiaGeneral = true
      for (const mes of meses) {
        const pagadosMes = pagos.filter(p => p.mes_cuota === mes).reduce((s, p) => s + p.monto, 0)
        const esperadoMes = montoMap[mes] ?? 0
        const estado = calcularEstadoMes(pagadosMes, esperadoMes)
        if (estado !== 'al_dia') { alDiaGeneral = false; deudaTotal += Math.max(0, esperadoMes - pagadosMes) }
      }
      if (alDiaGeneral) sociosAlDia++
      else morosos.push({ nombre: socio.nombre, deuda: deudaTotal })
    }

    setResumen({
      recaudado,
      esperado: (socios?.length ?? 0) * montoMesActual,
      sociosAlDia,
      totalSocios: socios?.length ?? 0,
      morosos: morosos.sort((a, b) => b.deuda - a.deuda),
      ultimosMovimientos: (movimientos ?? []).map(m => ({
        fecha: m.fecha_registro,
        glosa: m.glosa,
        monto: m.monto,
        tipo: m.tipo,
      })),
    })
  }

  if (!resumen) return <div>Cargando...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Recaudado este mes</p>
          <p className="text-2xl font-bold">${resumen.recaudado.toLocaleString('es-CL')}</p>
          <p className="text-xs text-gray-400">de ${resumen.esperado.toLocaleString('es-CL')} esperado</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Socios al día</p>
          <p className="text-2xl font-bold">{resumen.sociosAlDia} / {resumen.totalSocios}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Morosos</p>
          <p className="text-2xl font-bold text-red-600">{resumen.morosos.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-3">Morosos</h2>
        {resumen.morosos.length === 0
          ? <p className="text-gray-500 text-sm">Todos al día 🎉</p>
          : <ul className="space-y-1">{resumen.morosos.map(m => (
            <li key={m.nombre} className="flex justify-between text-sm">
              <span>{m.nombre}</span>
              <span className="text-red-600 font-medium">${m.deuda.toLocaleString('es-CL')}</span>
            </li>
          ))}</ul>
        }
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-3">Últimos movimientos</h2>
        <ul className="space-y-1">
          {resumen.ultimosMovimientos.map((m, i) => (
            <li key={i} className="flex justify-between text-sm">
              <span className="text-gray-500">{m.fecha}</span>
              <span className="flex-1 mx-4">{m.glosa}</span>
              <span className={m.tipo === 'gasto' ? 'text-red-600' : 'text-green-600'}>
                {m.tipo === 'gasto' ? '-' : '+'}${m.monto.toLocaleString('es-CL')}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar manualmente**

Login como tesorero → ver dashboard con tarjetas de resumen.

- [ ] **Step 3: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat: dashboard admin con resumen del mes y morosos"
```

---

### Task 13: Gestión de socios (`app/admin/socios/page.tsx`)

**Files:**
- Create: `app/admin/socios/page.tsx`

- [ ] **Step 1: Crear `app/admin/socios/page.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { supabase, type Socio } from '@/lib/supabase'
import { normalizeRut } from '@/lib/rut'
import { getSession } from '@/lib/session'
import {
  getCuotasConfig, getMovimientosDeSocio,
  calcularEstadoGeneral, calcularEstadoMes, generarMesesDesdeInicio
} from '@/lib/movimientos'
import { EstadoBadge } from '@/components/EstadoBadge'
import { RutInput } from '@/components/RutInput'

interface SocioConEstado extends Socio {
  deudaTotal: number
  estadoGeneral: 'al_dia' | 'parcial' | 'moroso'
  whatsappUrl: string
}

const EMPTY_FORM = { rut: '', nombre: '', telefono: '', fecha_ingreso: '' }

export default function SociosPage() {
  const [socios, setSocios] = useState<SocioConEstado[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const session = getSession()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('socios').select('*').eq('activo', true).order('nombre')
    const cuotas = await getCuotasConfig()
    const montoMap = Object.fromEntries(cuotas.map(c => [c.mes, c.monto]))
    const meses = generarMesesDesdeInicio()

    const resultado: SocioConEstado[] = []
    for (const s of data ?? []) {
      const pagos = await getMovimientosDeSocio(s.id)
      let deudaTotal = 0
      const estados = meses.map(mes => {
        const pagado = pagos.filter(p => p.mes_cuota === mes).reduce((a, p) => a + p.monto, 0)
        const esperado = montoMap[mes] ?? 0
        const estado = calcularEstadoMes(pagado, esperado)
        if (estado !== 'al_dia') deudaTotal += Math.max(0, esperado - pagado)
        return estado
      })
      const estadoGeneral = calcularEstadoGeneral(estados)
      const mesesMorosos = meses.filter((mes, i) => estados[i] !== 'al_dia')
        .map(m => new Date(m + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }))
        .join(', ')
      const msg = encodeURIComponent(
        `Hola ${s.nombre}, tienes ${mesesMorosos ? mesesMorosos.split(',').length : 0} mes(es) pendiente(s) por $${deudaTotal.toLocaleString('es-CL')}. Meses: ${mesesMorosos}.`
      )
      resultado.push({ ...s, deudaTotal, estadoGeneral, whatsappUrl: `https://wa.me/${s.telefono}?text=${msg}` })
    }
    setSocios(resultado)
    setLoading(false)
  }

  async function guardar() {
    setError('')
    const rut = normalizeRut(form.rut)
    if (!rut || !form.nombre || !form.fecha_ingreso) { setError('Completa todos los campos obligatorios.'); return }

    if (editId) {
      const { error: e } = await supabase.from('socios').update({ nombre: form.nombre, telefono: form.telefono, fecha_ingreso: form.fecha_ingreso }).eq('id', editId)
      if (e) { setError(e.message); return }
    } else {
      const { error: e } = await supabase.from('socios').insert({ rut, nombre: form.nombre, telefono: form.telefono, fecha_ingreso: form.fecha_ingreso, activo: true, es_admin: false })
      if (e) { setError(e.message); return }
    }
    setForm(EMPTY_FORM); setEditId(null); cargar()
  }

  async function darDeBaja(id: string) {
    if (!confirm('¿Dar de baja este socio?')) return
    await supabase.from('socios').update({ activo: false, creado_por: session?.rut ?? '' } as never).eq('id', id)
    cargar()
  }

  if (loading) return <div>Cargando...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Socios</h1>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">{editId ? 'Editar socio' : 'Agregar socio'}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm">RUT *</label>
            <RutInput value={form.rut} onChange={v => setForm(f => ({ ...f, rut: v }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-sm">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-sm">Teléfono (569...)</label>
            <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-sm">Fecha ingreso *</label>
            <input type="date" value={form.fecha_ingreso} onChange={e => setForm(f => ({ ...f, fecha_ingreso: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button onClick={guardar} className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700">
            {editId ? 'Guardar cambios' : 'Agregar'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm(EMPTY_FORM) }}
            className="px-4 py-1 rounded text-sm border hover:bg-gray-50">Cancelar</button>}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-left">RUT</th>
              <th className="px-4 py-2 text-center">Estado</th>
              <th className="px-4 py-2 text-right">Deuda</th>
              <th className="px-4 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {socios.map(s => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">{s.nombre}</td>
                <td className="px-4 py-2 text-gray-500">{s.rut}</td>
                <td className="px-4 py-2 text-center"><EstadoBadge estado={s.estadoGeneral} /></td>
                <td className="px-4 py-2 text-right">{s.deudaTotal > 0 ? `$${s.deudaTotal.toLocaleString('es-CL')}` : '—'}</td>
                <td className="px-4 py-2 text-center flex gap-2 justify-center">
                  <button onClick={() => { setEditId(s.id); setForm({ rut: s.rut, nombre: s.nombre, telefono: s.telefono ?? '', fecha_ingreso: s.fecha_ingreso }) }}
                    className="text-blue-600 hover:underline">Editar</button>
                  {s.deudaTotal > 0 && (
                    <a href={s.whatsappUrl} target="_blank"
                      className="text-green-600 hover:underline">WhatsApp</a>
                  )}
                  <button onClick={() => darDeBaja(s.id)} className="text-red-500 hover:underline">Baja</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar manualmente**

Panel admin → Socios → agregar socio de prueba → verificar que aparece en tabla con estado.

- [ ] **Step 3: Commit**

```bash
git add app/admin/socios/page.tsx
git commit -m "feat: gestión de socios con estado, edición y WhatsApp"
```

---

### Task 14: Formulario y lista de movimientos (`app/admin/movimientos/page.tsx`)

**Files:**
- Create: `app/admin/movimientos/page.tsx`

- [ ] **Step 1: Crear `app/admin/movimientos/page.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { supabase, type Movimiento, type TipoMovimiento } from '@/lib/supabase'
import { insertMovimiento, updateMovimiento } from '@/lib/movimientos'
import { getSession } from '@/lib/session'

const TIPOS: { value: TipoMovimiento; label: string }[] = [
  { value: 'pago_cuota', label: 'Pago de cuota' },
  { value: 'ingreso_extra', label: 'Ingreso extra' },
  { value: 'gasto', label: 'Gasto' },
]

const EMPTY: Omit<Movimiento, 'id' | 'creado_en'> = {
  tipo: 'pago_cuota', fecha_registro: new Date().toISOString().slice(0, 10),
  socio_id: null, mes_cuota: null, monto: 0, glosa: '', comprobante_url: null, creado_por: '',
}

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [socios, setSocios] = useState<{ id: string; nombre: string }[]>([])
  const [form, setForm] = useState<Omit<Movimiento, 'id' | 'creado_en'>>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimiento | 'todos'>('todos')
  const session = getSession()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: movs }, { data: socs }] = await Promise.all([
      supabase.from('movimientos').select('*').order('fecha_registro', { ascending: false }),
      supabase.from('socios').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setMovimientos(movs ?? [])
    setSocios(socs ?? [])
  }

  async function guardar() {
    setError('')
    if (!form.glosa.trim()) { setError('La glosa es obligatoria.'); return }
    if (form.monto <= 0) { setError('El monto debe ser mayor a 0.'); return }
    if (form.tipo === 'pago_cuota' && (!form.socio_id || !form.mes_cuota)) {
      setError('Para un pago de cuota debes seleccionar socio y mes.'); return
    }

    let comprobante_url = form.comprobante_url
    if (file) {
      if (file.size > 5 * 1024 * 1024) { setError('El comprobante no puede superar 5MB.'); return }
      const path = `${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('comprobantes').upload(path, file)
      if (uploadError) { setError(uploadError.message); return }
      const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path)
      comprobante_url = urlData.publicUrl
    }

    const payload = { ...form, comprobante_url, creado_por: session?.rut ?? '' }

    if (editId) {
      await updateMovimiento(editId, payload)
    } else {
      await insertMovimiento(payload)
    }

    setForm({ ...EMPTY, creado_por: session?.rut ?? '' })
    setEditId(null); setFile(null); cargar()
  }

  const filtrados = filtroTipo === 'todos' ? movimientos : movimientos.filter(m => m.tipo === filtroTipo)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Movimientos</h1>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">{editId ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Tipo *</label>
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoMovimiento, socio_id: null, mes_cuota: null }))}
              className="w-full border rounded px-2 py-1 text-sm">
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm">Fecha *</label>
            <input type="date" value={form.fecha_registro} onChange={e => setForm(f => ({ ...f, fecha_registro: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          {form.tipo === 'pago_cuota' && (
            <>
              <div>
                <label className="text-sm">Socio *</label>
                <select value={form.socio_id ?? ''} onChange={e => setForm(f => ({ ...f, socio_id: e.target.value || null }))}
                  className="w-full border rounded px-2 py-1 text-sm">
                  <option value="">Seleccionar...</option>
                  {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm">Mes que cubre *</label>
                <input type="month" value={form.mes_cuota ? form.mes_cuota.slice(0, 7) : ''}
                  onChange={e => setForm(f => ({ ...f, mes_cuota: e.target.value ? e.target.value + '-01' : null }))}
                  className="w-full border rounded px-2 py-1 text-sm" />
              </div>
            </>
          )}
          <div>
            <label className="text-sm">Monto *</label>
            <input type="number" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: Number(e.target.value) }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="text-sm">Glosa *</label>
            <input value={form.glosa} onChange={e => setForm(f => ({ ...f, glosa: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm" placeholder="Descripción del movimiento" />
          </div>
          <div>
            <label className="text-sm">Comprobante (máx 5MB)</label>
            <input type="file" accept="image/*,.pdf" onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm" />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button onClick={guardar} className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700">
            {editId ? 'Guardar cambios' : 'Registrar'}
          </button>
          {editId && <button onClick={() => { setEditId(null); setForm(EMPTY) }}
            className="px-4 py-1 rounded text-sm border hover:bg-gray-50">Cancelar</button>}
        </div>
      </div>

      <div className="flex gap-3 items-center">
        <span className="text-sm font-medium">Filtrar:</span>
        {(['todos', ...TIPOS.map(t => t.value)] as const).map(t => (
          <button key={t} onClick={() => setFiltroTipo(t as typeof filtroTipo)}
            className={`text-sm px-3 py-1 rounded-full border ${filtroTipo === t ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}>
            {t === 'todos' ? 'Todos' : TIPOS.find(x => x.value === t)?.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Fecha</th>
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-left">Glosa</th>
              <th className="px-4 py-2 text-right">Monto</th>
              <th className="px-4 py-2 text-center">Comprobante</th>
              <th className="px-4 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map(m => (
              <tr key={m.id} className="border-t">
                <td className="px-4 py-2">{m.fecha_registro}</td>
                <td className="px-4 py-2">{TIPOS.find(t => t.value === m.tipo)?.label}</td>
                <td className="px-4 py-2">{m.glosa}</td>
                <td className={`px-4 py-2 text-right ${m.tipo === 'gasto' ? 'text-red-600' : 'text-green-600'}`}>
                  {m.tipo === 'gasto' ? '-' : '+'}${m.monto.toLocaleString('es-CL')}
                </td>
                <td className="px-4 py-2 text-center">
                  {m.comprobante_url && <a href={m.comprobante_url} target="_blank" className="text-blue-600 hover:underline">Ver</a>}
                </td>
                <td className="px-4 py-2 text-center">
                  <button onClick={() => { setEditId(m.id); setForm({ tipo: m.tipo, fecha_registro: m.fecha_registro, socio_id: m.socio_id, mes_cuota: m.mes_cuota, monto: m.monto, glosa: m.glosa, comprobante_url: m.comprobante_url, creado_por: m.creado_por }) }}
                    className="text-blue-600 hover:underline">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar manualmente**

Admin → Movimientos → registrar un pago de cuota y un gasto → verificar que aparecen en la lista.

- [ ] **Step 3: Commit**

```bash
git add app/admin/movimientos/page.tsx
git commit -m "feat: formulario y lista de movimientos con filtros"
```

---

### Task 15: Reportes Excel (`app/admin/reportes/page.tsx` + `lib/excel.ts`)

**Files:**
- Create: `lib/excel.ts`
- Create: `app/admin/reportes/page.tsx`

- [ ] **Step 1: Crear `lib/excel.ts`**

```typescript
import * as XLSX from 'xlsx'
import type { Movimiento } from './supabase'

export function exportarMovimientos(movimientos: Movimiento[], nombreArchivo = 'movimientos') {
  const filas = movimientos.map(m => ({
    Fecha: m.fecha_registro,
    Tipo: m.tipo,
    Glosa: m.glosa,
    Monto: m.tipo === 'gasto' ? -m.monto : m.monto,
    Comprobante: m.comprobante_url ?? '',
    Registrado_por: m.creado_por,
  }))
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`)
}

export function exportarMorosos(
  morosos: { nombre: string; rut: string; deuda: number; mesesPendientes: string[] }[],
  nombreArchivo = 'morosos'
) {
  const filas = morosos.map(m => ({
    Nombre: m.nombre,
    RUT: m.rut,
    Deuda_Total: m.deuda,
    Meses_Pendientes: m.mesesPendientes.join(', '),
  }))
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Morosos')
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`)
}
```

- [ ] **Step 2: Crear `app/admin/reportes/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { exportarMovimientos, exportarMorosos } from '@/lib/excel'
import { getCuotasConfig, getMovimientosDeSocio, calcularEstadoMes, generarMesesDesdeInicio } from '@/lib/movimientos'

export default function ReportesPage() {
  const [desde, setDesde] = useState('2024-08-01')
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [generando, setGenerando] = useState(false)

  async function descargarMovimientos() {
    setGenerando(true)
    const { data } = await supabase.from('movimientos').select('*')
      .gte('fecha_registro', desde).lte('fecha_registro', hasta)
      .order('fecha_registro')
    exportarMovimientos(data ?? [], `movimientos_${desde}_${hasta}`)
    setGenerando(false)
  }

  async function descargarMorosos() {
    setGenerando(true)
    const [{ data: socios }, cuotas] = await Promise.all([
      supabase.from('socios').select('id, rut, nombre').eq('activo', true),
      getCuotasConfig(),
    ])
    const montoMap = Object.fromEntries(cuotas.map(c => [c.mes, c.monto]))
    const meses = generarMesesDesdeInicio()
    const morosos = []
    for (const s of socios ?? []) {
      const pagos = await getMovimientosDeSocio(s.id)
      let deuda = 0
      const mesesPendientes: string[] = []
      for (const mes of meses) {
        const pagado = pagos.filter(p => p.mes_cuota === mes).reduce((a, p) => a + p.monto, 0)
        const esperado = montoMap[mes] ?? 0
        if (calcularEstadoMes(pagado, esperado) !== 'al_dia') {
          deuda += Math.max(0, esperado - pagado)
          mesesPendientes.push(new Date(mes + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }))
        }
      }
      if (deuda > 0) morosos.push({ nombre: s.nombre, rut: s.rut, deuda, mesesPendientes })
    }
    exportarMorosos(morosos, `morosos_${new Date().toISOString().slice(0, 10)}`)
    setGenerando(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>
      <div className="bg-white rounded-xl shadow p-4 space-y-4">
        <div className="flex gap-4 items-end">
          <div>
            <label className="text-sm font-medium">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="block border rounded px-2 py-1 text-sm mt-1" />
          </div>
          <div>
            <label className="text-sm font-medium">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="block border rounded px-2 py-1 text-sm mt-1" />
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={descargarMovimientos} disabled={generando}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50">
            Descargar movimientos (.xlsx)
          </button>
          <button onClick={descargarMorosos} disabled={generando}
            className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50">
            Descargar morosos (.xlsx)
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verificar manualmente**

Admin → Reportes → descargar movimientos → verificar que se descarga el archivo `.xlsx`.

- [ ] **Step 4: Commit**

```bash
git add lib/excel.ts app/admin/reportes/page.tsx
git commit -m "feat: exportación Excel de movimientos y morosos"
```

---

### Task 16: Configuración de cuotas (`app/admin/configuracion/page.tsx`)

**Files:**
- Create: `app/admin/configuracion/page.tsx`

- [ ] **Step 1: Crear `app/admin/configuracion/page.tsx`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { supabase, type CuotaConfig } from '@/lib/supabase'
import { generarMesesDesdeInicio } from '@/lib/movimientos'
import { getSession } from '@/lib/session'

export default function ConfiguracionPage() {
  const [cuotas, setCuotas] = useState<CuotaConfig[]>([])
  const [editMes, setEditMes] = useState<string | null>(null)
  const [monto, setMonto] = useState('')
  const session = getSession()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('cuotas_config').select('*').order('mes')
    setCuotas(data ?? [])
  }

  async function guardar(mes: string) {
    const montoNum = Number(monto)
    if (!montoNum || montoNum <= 0) return
    const existing = cuotas.find(c => c.mes === mes)
    if (existing) {
      await supabase.from('cuotas_config').update({ monto: montoNum }).eq('id', existing.id)
    } else {
      await supabase.from('cuotas_config').insert({ mes, monto: montoNum })
    }
    setEditMes(null); setMonto(''); cargar()
  }

  const meses = generarMesesDesdeInicio()
  const montoMap = Object.fromEntries(cuotas.map(c => [c.mes, c.monto]))

  function formatMes(mes: string) {
    return new Date(mes + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuración de cuotas</h1>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Mes</th>
              <th className="px-4 py-2 text-right">Monto</th>
              <th className="px-4 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {meses.map(mes => (
              <tr key={mes} className="border-t">
                <td className="px-4 py-2 capitalize">{formatMes(mes)}</td>
                <td className="px-4 py-2 text-right">
                  {editMes === mes ? (
                    <input type="number" value={monto} onChange={e => setMonto(e.target.value)}
                      className="border rounded px-2 py-1 w-28 text-right" autoFocus />
                  ) : (
                    montoMap[mes] ? `$${Number(montoMap[mes]).toLocaleString('es-CL')}` : <span className="text-gray-400">No configurado</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  {editMes === mes ? (
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => guardar(mes)} className="text-green-600 hover:underline">Guardar</button>
                      <button onClick={() => { setEditMes(null); setMonto('') }} className="text-gray-500 hover:underline">Cancelar</button>
                    </div>
                  ) : (
                    <button onClick={() => { setEditMes(mes); setMonto(String(montoMap[mes] ?? '')) }}
                      className="text-blue-600 hover:underline">
                      {montoMap[mes] ? 'Editar' : 'Configurar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar manualmente**

Admin → Configuración → configurar monto para un mes → verificar que se guarda y refleja en vista de socios.

- [ ] **Step 3: Commit**

```bash
git add app/admin/configuracion/page.tsx
git commit -m "feat: configuración de monto de cuota por mes"
```

---

## FASE 3 — Integración y lanzamiento

---

### Task 17: Script importación desde Excel (`scripts/import_planilla.py`)

**Files:**
- Create: `scripts/import_planilla.py`
- Create: `scripts/requirements.txt`

- [ ] **Step 1: Crear `scripts/requirements.txt`**

```
openpyxl==3.1.2
supabase==2.3.4
python-dotenv==1.0.0
```

- [ ] **Step 2: Instalar dependencias del script**

```bash
cd scripts
pip install -r requirements.txt
```

- [ ] **Step 3: Crear `scripts/import_planilla.py`**

```python
"""
Script de importación única desde planilla Excel a Supabase.
Estructura esperada del Excel:
  - Hoja "Socios": columnas RUT, Nombre, Telefono, FechaIngreso
  - Hoja "Pagos": columnas RUT, Mes (YYYY-MM), Monto, Glosa, Fecha
  - Hoja "Gastos": columnas Fecha, Monto, Glosa
  - Hoja "Ingresos": columnas Fecha, Monto, Glosa
"""
import os
import hashlib
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client
import openpyxl

load_dotenv('../.env.local')

url = os.environ['NEXT_PUBLIC_SUPABASE_URL']
key = os.environ['NEXT_PUBLIC_SUPABASE_ANON_KEY']
supabase = create_client(url, key)

ARCHIVO = 'planilla.xlsx'  # Coloca el Excel en la carpeta scripts/
ADMIN_RUT = os.environ.get('NEXT_PUBLIC_ADMIN_RUT', 'admin')


def normalizar_rut(rut: str) -> str:
    clean = str(rut).replace('.', '').replace('-', '').strip().lower()
    if len(clean) < 2:
        return clean
    return f"{clean[:-1]}-{clean[-1]}"


def importar_socios(ws):
    print("Importando socios...")
    for row in ws.iter_rows(min_row=2, values_only=True):
        rut, nombre, telefono, fecha_ingreso = row[:4]
        if not rut:
            continue
        rut_norm = normalizar_rut(rut)
        existing = supabase.table('socios').select('id').eq('rut', rut_norm).execute()
        if existing.data:
            print(f"  SKIP {rut_norm} (ya existe)")
            continue
        fecha = fecha_ingreso if isinstance(fecha_ingreso, str) else str(fecha_ingreso)[:10]
        supabase.table('socios').insert({
            'rut': rut_norm,
            'nombre': str(nombre),
            'telefono': str(telefono) if telefono else None,
            'fecha_ingreso': fecha,
            'activo': True,
            'es_admin': False,
        }).execute()
        print(f"  OK {rut_norm} - {nombre}")


def importar_pagos(ws):
    print("Importando pagos...")
    socios_map = {s['rut']: s['id'] for s in supabase.table('socios').select('id, rut').execute().data}
    for row in ws.iter_rows(min_row=2, values_only=True):
        rut, mes, monto, glosa, fecha = row[:5]
        if not rut or not monto:
            continue
        rut_norm = normalizar_rut(rut)
        socio_id = socios_map.get(rut_norm)
        if not socio_id:
            print(f"  WARN: socio {rut_norm} no encontrado, saltando pago")
            continue
        mes_str = str(mes)[:7] + '-01' if mes else None
        fecha_str = str(fecha)[:10] if fecha else mes_str
        supabase.table('movimientos').insert({
            'tipo': 'pago_cuota',
            'fecha_registro': fecha_str,
            'socio_id': socio_id,
            'mes_cuota': mes_str,
            'monto': float(monto),
            'glosa': str(glosa) if glosa else 'Pago cuota',
            'creado_por': ADMIN_RUT,
        }).execute()
        print(f"  OK {rut_norm} mes {mes_str} ${monto}")


def importar_movimientos(ws, tipo: str):
    print(f"Importando {tipo}...")
    for row in ws.iter_rows(min_row=2, values_only=True):
        fecha, monto, glosa = row[:3]
        if not monto:
            continue
        fecha_str = str(fecha)[:10] if fecha else datetime.today().strftime('%Y-%m-%d')
        supabase.table('movimientos').insert({
            'tipo': tipo,
            'fecha_registro': fecha_str,
            'monto': float(monto),
            'glosa': str(glosa) if glosa else tipo,
            'creado_por': ADMIN_RUT,
        }).execute()
        print(f"  OK {fecha_str} ${monto} - {glosa}")


if __name__ == '__main__':
    wb = openpyxl.load_workbook(ARCHIVO)
    if 'Socios' in wb.sheetnames:
        importar_socios(wb['Socios'])
    if 'Pagos' in wb.sheetnames:
        importar_pagos(wb['Pagos'])
    if 'Gastos' in wb.sheetnames:
        importar_movimientos(wb['Gastos'], 'gasto')
    if 'Ingresos' in wb.sheetnames:
        importar_movimientos(wb['Ingresos'], 'ingreso_extra')
    print("\nImportación completada.")
```

- [ ] **Step 4: Preparar y ejecutar**

1. Copia tu planilla Excel a `scripts/planilla.xlsx`
2. Asegúrate que tenga hojas: `Socios`, `Pagos`, `Gastos`, `Ingresos` con las columnas indicadas
3. Ejecutar:

```bash
cd scripts
python import_planilla.py
```
Expected: líneas `OK` por cada registro importado, sin errores.

- [ ] **Step 5: Commit**

```bash
git add scripts/
git commit -m "feat: script importación histórico desde Excel"
```

---

### Task 18: Deploy en Vercel

**Files:** ninguno (configuración en plataforma)

- [ ] **Step 1: Subir código a GitHub**

```bash
gh repo create club-cuotas --private --source=. --push
```

- [ ] **Step 2: Conectar en Vercel**

1. Ir a [vercel.com](https://vercel.com) → New Project → importar repo `club-cuotas`
2. Framework: Next.js (detectado automáticamente)
3. Agregar variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL` → URL de tu proyecto Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Anon key de Supabase
4. Deploy

- [ ] **Step 3: Verificar deploy**

Abrir URL pública de Vercel → login con RUT de socio → verificar que carga correctamente.

- [ ] **Step 4: Commit final**

```bash
git add .
git commit -m "chore: configuración lista para deploy Vercel"
```

---

## Resumen de tareas

| # | Tarea | Fase |
|---|---|---|
| 1 | Inicializar proyecto Next.js | Core |
| 2 | Schema Supabase | Core |
| 3 | Utilidad RUT | Core |
| 4 | Cliente Supabase y tipos | Core |
| 5 | Sesión (sessionStorage) | Core |
| 6 | Lógica movimientos y estado | Core |
| 7 | Componente RutInput | Core |
| 8 | Componente EstadoBadge | Core |
| 9 | Página login | Core |
| 10 | Vista socio | Core |
| 11 | Layout admin con guard | Admin |
| 12 | Dashboard admin | Admin |
| 13 | Gestión socios + WhatsApp | Admin |
| 14 | Formulario y lista movimientos | Admin |
| 15 | Reportes Excel | Admin |
| 16 | Configuración cuotas | Admin |
| 17 | Script importación Excel | Lanzamiento |
| 18 | Deploy Vercel | Lanzamiento |
