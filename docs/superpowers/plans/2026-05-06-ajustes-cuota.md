# Ajustes de cuota por socio + edición de `fecha_ingreso` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir al tesorero (a) editar el monto adeudado de un socio en un mes específico con glosa obligatoria y (b) editar la `fecha_ingreso` de un socio desde la UI. Resuelve los casos reales Patricio Lagos y Juan Landaeta documentados en el spec.

**Architecture:** Tabla nueva `ajustes_cuota` con override de monto por par `(socio_id, mes)`. `calcularEstado` y `calcularDashboard` aceptan un parámetro nuevo `ajustes` y lo honran (omitir mes si monto=0, sustituir monto si monto>0). Cuatro endpoints REST nuevos (`/api/ajustes` GET/POST/DELETE, `/api/ajustes/bulk` POST) + un PATCH a `/api/socios/[id]`. UI integrada en `/socios/[id]` con modal individual y bulk; los meses ajustados quedan visibles también en `/mi/[rut]`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (PostgreSQL gestionado), Vitest, Tailwind v3.

**Spec:** `docs/superpowers/specs/2026-05-06-ajustes-cuota-design.md`.

---

## File map

| Archivo | Rol |
|---|---|
| `db/2026-05-06_ajustes_cuota.sql` | (nuevo) migración SQL — ejecutar manualmente en Supabase y commitear |
| `lib/supabase.ts` | agregar tipo `AjusteCuota` |
| `lib/movimientos.ts` | extender `calcularEstado` y `calcularDashboard` con `ajustes` |
| `lib/__tests__/movimientos.test.ts` | nuevos casos de test |
| `app/api/ajustes/route.ts` | (nuevo) GET, POST upsert, DELETE |
| `app/api/ajustes/bulk/route.ts` | (nuevo) POST bulk |
| `app/api/socios/[id]/route.ts` | (nuevo) PATCH `fecha_ingreso` |
| `app/api/cron/resumen-morosos/route.ts` | cargar ajustes y pasarlos al cálculo |
| `app/dashboard/page.tsx` | cargar ajustes |
| `app/socios/page.tsx` | cargar ajustes |
| `app/socios/[id]/page.tsx` | cargar ajustes y pasarlos al cliente |
| `app/socios/[id]/socio-detail-client.tsx` | (nuevo) Client Component con UI de edición |
| `app/mi/[rut]/page.tsx` | mostrar badges de ajuste |
| `PROGRESO.md` | actualizar al cierre |

---

## Task 1: Migración SQL — tabla `ajustes_cuota`

**Files:**
- Create: `db/2026-05-06_ajustes_cuota.sql`
- (manual) ejecutar en Supabase SQL Editor del proyecto `klwozyqryqndwzysetcj`

- [ ] **Step 1: Crear el archivo SQL en el repo**

```sql
-- db/2026-05-06_ajustes_cuota.sql
-- Override del monto adeudado por par (socio_id, mes) con glosa obligatoria.
-- Ejecutar en SQL Editor de Supabase manualmente.

create table if not exists public.ajustes_cuota (
  id          uuid primary key default gen_random_uuid(),
  socio_id    uuid not null references public.socios(id) on delete cascade,
  mes         date not null,
  monto       numeric(10,0) not null check (monto >= 0),
  glosa       text not null check (length(trim(glosa)) > 0),
  creado_en   timestamptz not null default now(),
  creado_por  text not null,
  unique (socio_id, mes)
);

create index if not exists ajustes_cuota_socio_idx
  on public.ajustes_cuota(socio_id);

alter table public.ajustes_cuota enable row level security;

-- Sin policies por ahora: igual que `movimientos`, todo el acceso pasa por
-- endpoints /api/* que validan la cookie de sesión vía middleware.
```

- [ ] **Step 2: Ejecutar la migración manualmente**

Abrir el SQL Editor de Supabase y ejecutar el contenido del archivo. Verificar después con:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'ajustes_cuota'
order by ordinal_position;
```

Esperado: 7 filas (id, socio_id, mes, monto, glosa, creado_en, creado_por).

- [ ] **Step 3: Commit**

```bash
git add db/2026-05-06_ajustes_cuota.sql
git commit -m "feat(db): tabla ajustes_cuota (migración manual)"
```

---

## Task 2: Tipo TypeScript `AjusteCuota`

**Files:**
- Modify: `lib/supabase.ts`

- [ ] **Step 1: Agregar el tipo después de `Movimiento`**

En `lib/supabase.ts`, justo después del tipo `Movimiento`, agregar:

```ts
export type AjusteCuota = {
  id: string;
  socio_id: string;
  mes: string;          // 'YYYY-MM-01'
  monto: number;
  glosa: string;
  creado_en: string;
  creado_por: string;
};
```

- [ ] **Step 2: Verificar typecheck**

```bash
npx tsc --noEmit
```

Expected: sin output (clean).

- [ ] **Step 3: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat(types): AjusteCuota"
```

---

## Task 3: Test fallido para `calcularEstado` con ajuste $0

**Files:**
- Modify: `lib/__tests__/movimientos.test.ts`

- [ ] **Step 1: Agregar helper `makeAjuste` después de `makeCuota`**

```ts
function makeAjuste(socioId: string, mes: string, monto: number, glosa = 'test'): import('@/lib/supabase').AjusteCuota {
  return {
    id: `ajuste-${socioId}-${mes}`,
    socio_id: socioId,
    mes,
    monto,
    glosa,
    creado_en: '2026-05-06T12:00:00Z',
    creado_por: '17353638-0',
  };
}
```

(Si en el archivo no estaba importada `AjusteCuota` arriba, agregar al import: `import type { Socio, Movimiento, CuotaConfig, AjusteCuota } from '@/lib/supabase';` y reemplazar el tipo inline del retorno por `AjusteCuota`.)

- [ ] **Step 2: Agregar el primer test del bloque "ajustes" al final de `describe('calcularEstado'`**

```ts
  it('ajuste con monto=0 omite el mes del cálculo', () => {
    const socio = makeSocio({ id: 's-pat', fecha_ingreso: '2024-07-01' });
    const cuotas = [
      makeCuota('2024-07-01'),
      makeCuota('2024-08-01'),
      makeCuota('2024-09-01'),
    ];
    const ajustes = [
      makeAjuste('s-pat', '2024-08-01', 0, 'mudanza'),
    ];

    const r = calcularEstado(socio, [], cuotas, ajustes, '2024-09-01');

    expect(r.mesesAdeudados).toEqual(['2024-07-01']);
    expect(r.mesesAdeudados).not.toContain('2024-08-01');
    expect(r.estado).toBe('moroso');
  });
```

- [ ] **Step 3: Correr y confirmar que falla (TypeScript / runtime)**

```bash
npm test
```

Expected: el test debería fallar — la firma actual de `calcularEstado` no acepta `ajustes`. TypeScript marcará el error de tipos al compilar el test.

- [ ] **Step 4: Commit (test fallido)**

```bash
git add lib/__tests__/movimientos.test.ts
git commit -m "test: ajustes en calcularEstado (failing)"
```

---

## Task 4: Implementar soporte de ajustes en `calcularEstado`

**Files:**
- Modify: `lib/movimientos.ts`
- Modify: `lib/__tests__/movimientos.test.ts`

- [ ] **Step 1: Cambiar la firma y la lógica de `calcularEstado`**

Reemplazar la función completa por:

```ts
export function calcularEstado(
  socio: Socio,
  movimientos: Movimiento[],
  cuotasConfig: CuotaConfig[],
  ajustes: AjusteCuota[],
  mesReferencia: string = mesActual()
): { estado: EstadoSocio; mesesAdeudados: string[]; montoAdeudado: number } {
  if (!socio.activo) {
    return { estado: 'inactivo', mesesAdeudados: [], montoAdeudado: 0 };
  }

  const ingreso = socio.fecha_ingreso.slice(0, 7) + '-01';

  const mesesEsperados: string[] = [];
  const cursor = new Date(ingreso + 'T12:00:00');
  const fin = new Date(mesReferencia + 'T12:00:00');
  while (cursor <= fin) {
    mesesEsperados.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const mesesPagados = new Set(
    movimientos
      .filter((m) => m.socio_id === socio.id && m.tipo === 'pago_cuota' && m.mes_cuota)
      .map((m) => m.mes_cuota as string)
  );

  // Ajustes del socio indexados por mes para lookup O(1).
  const ajustesPorMes = new Map<string, AjusteCuota>();
  for (const a of ajustes) {
    if (a.socio_id === socio.id) ajustesPorMes.set(a.mes, a);
  }

  const mesesAdeudados: string[] = [];
  let montoAdeudado = 0;

  for (const mes of mesesEsperados) {
    if (mes >= mesReferencia) continue;          // solo meses pasados
    if (mesesPagados.has(mes)) continue;          // ya pagó
    const ajuste = ajustesPorMes.get(mes);
    if (ajuste && ajuste.monto === 0) continue;   // ajuste $0 = omite

    const monto = ajuste
      ? ajuste.monto
      : (cuotasConfig.find((c) => c.mes === mes)?.monto ?? 0);

    mesesAdeudados.push(mes);
    montoAdeudado += monto;
  }

  if (mesesAdeudados.length > 0) {
    return { estado: 'moroso', mesesAdeudados, montoAdeudado };
  }
  if (mesesPagados.has(mesReferencia)) {
    return { estado: 'al_dia', mesesAdeudados: [], montoAdeudado: 0 };
  }
  return { estado: 'pendiente', mesesAdeudados: [], montoAdeudado: 0 };
}
```

Y agregar al import del archivo:

```ts
import type { Movimiento, Socio, CuotaConfig, AjusteCuota } from './supabase';
```

- [ ] **Step 2: Actualizar todos los tests existentes que llaman a `calcularEstado`**

En `lib/__tests__/movimientos.test.ts`, todos los `calcularEstado(socio, movs, cuotas, '...')` actuales necesitan un `[]` extra como cuarto argumento (ajustes vacíos). Buscar y reemplazar manualmente:

- `calcularEstado(socio, [], [], '2024-09-01')` → `calcularEstado(socio, [], [], [], '2024-09-01')`
- `calcularEstado(socio, movs, cuotas, '2024-09-01')` → `calcularEstado(socio, movs, cuotas, [], '2024-09-01')`
- `calcularEstado(socio, [], cuotas, '2024-09-01')` → `calcularEstado(socio, [], cuotas, [], '2024-09-01')`
- (Aplicar a todos los tests del bloque, son 7 llamadas)

- [ ] **Step 3: Correr tests**

```bash
npm test
```

Expected: PASS, incluyendo el nuevo test "ajuste con monto=0 omite el mes del cálculo" del Task 3.

- [ ] **Step 4: Commit**

```bash
git add lib/movimientos.ts lib/__tests__/movimientos.test.ts
git commit -m "feat(movimientos): calcularEstado honra ajustes_cuota"
```

---

## Task 5: Tests adicionales del cálculo + `calcularDashboard`

**Files:**
- Modify: `lib/__tests__/movimientos.test.ts`
- Modify: `lib/movimientos.ts`

- [ ] **Step 1: Agregar tests al bloque `describe('calcularEstado'`**

```ts
  it('ajuste con monto>0 cambia el monto adeudado del mes', () => {
    const socio = makeSocio({ id: 's-beca', fecha_ingreso: '2024-07-01' });
    const cuotas = [
      makeCuota('2024-07-01', 7000),
      makeCuota('2024-08-01', 7000),
    ];
    const ajustes = [
      makeAjuste('s-beca', '2024-07-01', 3500, 'beca media'),
    ];

    const r = calcularEstado(socio, [], cuotas, ajustes, '2024-08-01');

    expect(r.mesesAdeudados).toEqual(['2024-07-01']);
    expect(r.montoAdeudado).toBe(3500);
    expect(r.estado).toBe('moroso');
  });

  it('ajuste + pago_cuota del mismo mes deja el mes saldado', () => {
    const socio = makeSocio({ id: 's-x', fecha_ingreso: '2024-07-01' });
    const cuotas = [makeCuota('2024-07-01', 7000), makeCuota('2024-08-01', 7000)];
    const ajustes = [makeAjuste('s-x', '2024-07-01', 3500, 'beca media')];
    const movs = [
      makePago({ socio_id: 's-x', mes_cuota: '2024-07-01', monto: 3500, fecha_registro: '2024-07-10' }),
    ];

    const r = calcularEstado(socio, movs, cuotas, ajustes, '2024-08-01');

    expect(r.mesesAdeudados).toEqual([]);
    expect(r.estado).toBe('pendiente');
  });

  it('caso Patricio: 21 ajustes a $0 → no moroso', () => {
    const socio = makeSocio({ id: 's-pat', fecha_ingreso: '2024-08-01' });
    const meses = [
      '2024-08-01','2024-09-01','2024-10-01','2024-11-01','2024-12-01',
      '2025-01-01','2025-02-01','2025-03-01','2025-04-01','2025-05-01',
      '2025-06-01','2025-07-01','2025-08-01','2025-09-01','2025-10-01',
      '2025-11-01','2025-12-01','2026-01-01','2026-02-01','2026-03-01',
      '2026-04-01',
    ];
    const cuotas = meses.map((m) => makeCuota(m, 7000));
    const ajustes = meses.map((m) => makeAjuste('s-pat', m, 0, 'mudanza'));

    const r = calcularEstado(socio, [], cuotas, ajustes, '2026-05-01');

    expect(r.mesesAdeudados).toEqual([]);
    expect(r.montoAdeudado).toBe(0);
    expect(r.estado).toBe('pendiente'); // mes 2026-05 aún sin pagar y sin ajuste
  });
```

- [ ] **Step 2: Correr y verificar PASS**

```bash
npm test
```

Expected: todos los tests verdes, incluidos los nuevos.

- [ ] **Step 3: Modificar `calcularDashboard` para aceptar ajustes**

En `lib/movimientos.ts`, reemplazar la firma de `calcularDashboard`:

```ts
export function calcularDashboard(
  socios: Socio[],
  movimientos: Movimiento[],
  cuotasConfig: CuotaConfig[],
  ajustes: AjusteCuota[]
): DashboardSummary {
  const mes = mesActual();
  let sociosActivos = 0;
  let pagaronEsteMes = 0;
  let morosos = 0;
  let inactivos = 0;
  let recaudadoMes = 0;
  const morososDetalle: DashboardSummary['morososDetalle'] = [];

  for (const socio of socios) {
    const r = calcularEstado(socio, movimientos, cuotasConfig, ajustes, mes);
    if (r.estado === 'inactivo') { inactivos++; continue; }
    sociosActivos++;
    if (r.estado === 'al_dia') pagaronEsteMes++;
    if (r.estado === 'moroso') {
      morosos++;
      morososDetalle.push({
        socio,
        mesesAdeudados: r.mesesAdeudados,
        montoAdeudado: r.montoAdeudado,
      });
    }
  }

  const inicioMes = new Date(mes + 'T12:00:00');
  const finMes = new Date(mes + 'T12:00:00');
  finMes.setMonth(finMes.getMonth() + 1);
  recaudadoMes = movimientos
    .filter((m) => {
      const fr = new Date(m.fecha_registro + 'T12:00:00');
      return (
        (m.tipo === 'pago_cuota' || m.tipo === 'pago_extra') &&
        fr >= inicioMes &&
        fr < finMes
      );
    })
    .reduce((sum, m) => sum + Number(m.monto), 0);

  morososDetalle.sort((a, b) => b.mesesAdeudados.length - a.mesesAdeudados.length);

  return { sociosActivos, pagaronEsteMes, morosos, inactivos, recaudadoMes, morososDetalle };
}
```

- [ ] **Step 4: Actualizar tests de `calcularDashboard`**

En el bloque `describe('calcularDashboard'`, las llamadas existentes pasan a 4 args. Buscar `calcularDashboard(socios, movs, cuotas)` y reemplazar por `calcularDashboard(socios, movs, cuotas, [])`. Son 2 llamadas.

- [ ] **Step 5: Correr y commit**

```bash
npm test
git add lib/movimientos.ts lib/__tests__/movimientos.test.ts
git commit -m "feat(movimientos): calcularDashboard honra ajustes; tests adicionales"
```

---

## Task 6: Endpoint `GET /api/ajustes`

**Files:**
- Create: `app/api/ajustes/route.ts`

- [ ] **Step 1: Crear el archivo con GET, POST y DELETE**

```ts
// app/api/ajustes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';
import { getSession } from '@/lib/session';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const url = new URL(req.url);
  const socioId = url.searchParams.get('socio_id');

  const supabase = await createSupabaseServer();
  let q = supabase
    .from('ajustes_cuota')
    .select('*')
    .order('mes', { ascending: false });
  if (socioId) q = q.eq('socio_id', socioId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ajustes: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const socioId: string | undefined = body?.socio_id;
  const mes: string | undefined = body?.mes;
  const monto = Number(body?.monto);
  const glosa = String(body?.glosa ?? '').trim();

  if (!socioId || !mes || !/^\d{4}-\d{2}-01$/.test(mes)) {
    return NextResponse.json({ error: 'socio_id y mes (YYYY-MM-01) son obligatorios' }, { status: 400 });
  }
  if (!Number.isFinite(monto) || monto < 0) {
    return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
  }
  if (glosa.length === 0) {
    return NextResponse.json({ error: 'Glosa obligatoria' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('ajustes_cuota')
    .upsert(
      {
        socio_id: socioId,
        mes,
        monto,
        glosa,
        creado_por: session.rut,
        creado_en: new Date().toISOString(),
      },
      { onConflict: 'socio_id,mes' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ajuste: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from('ajustes_cuota').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/api/ajustes/route.ts
git commit -m "feat(api): /api/ajustes GET, POST upsert, DELETE"
```

---

## Task 7: Endpoint `POST /api/ajustes/bulk`

**Files:**
- Create: `app/api/ajustes/bulk/route.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// app/api/ajustes/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';
import { getSession } from '@/lib/session';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const socioId: string | undefined = body?.socio_id;
  const mesDesde: string | undefined = body?.mes_desde;
  const mesHasta: string | undefined = body?.mes_hasta;
  const monto = Number(body?.monto);
  const glosa = String(body?.glosa ?? '').trim();

  const re = /^\d{4}-\d{2}-01$/;
  if (!socioId || !mesDesde || !mesHasta || !re.test(mesDesde) || !re.test(mesHasta)) {
    return NextResponse.json(
      { error: 'socio_id, mes_desde y mes_hasta (YYYY-MM-01) son obligatorios' },
      { status: 400 }
    );
  }
  if (mesHasta < mesDesde) {
    return NextResponse.json({ error: 'mes_hasta debe ser >= mes_desde' }, { status: 400 });
  }
  if (!Number.isFinite(monto) || monto < 0) {
    return NextResponse.json({ error: 'Monto inválido' }, { status: 400 });
  }
  if (glosa.length === 0) {
    return NextResponse.json({ error: 'Glosa obligatoria' }, { status: 400 });
  }

  // Expandir el rango a una lista de meses 'YYYY-MM-01'.
  const meses: string[] = [];
  const cursor = new Date(mesDesde + 'T12:00:00');
  const fin = new Date(mesHasta + 'T12:00:00');
  while (cursor <= fin) {
    meses.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  const ahora = new Date().toISOString();
  const filas = meses.map((mes) => ({
    socio_id: socioId,
    mes,
    monto,
    glosa,
    creado_por: session.rut,
    creado_en: ahora,
  }));

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('ajustes_cuota')
    .upsert(filas, { onConflict: 'socio_id,mes' })
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ajustes: data, total: data?.length ?? 0 }, { status: 201 });
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/ajustes/bulk/route.ts
git commit -m "feat(api): /api/ajustes/bulk POST con expansión de rango"
```

---

## Task 8: Endpoint `PATCH /api/socios/[id]` con `fecha_ingreso`

**Files:**
- Create: `app/api/socios/[id]/route.ts`

- [ ] **Step 1: Crear el archivo**

```ts
// app/api/socios/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';
import { getSession } from '@/lib/session';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);

  const update: Record<string, unknown> = {};

  if ('fecha_ingreso' in (body ?? {})) {
    const fi: string = body.fecha_ingreso;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fi)) {
      return NextResponse.json({ error: 'fecha_ingreso inválida (YYYY-MM-DD)' }, { status: 400 });
    }
    const hoy = new Date().toISOString().slice(0, 10);
    if (fi > hoy) {
      return NextResponse.json({ error: 'fecha_ingreso no puede ser futura' }, { status: 400 });
    }
    update.fecha_ingreso = fi;
  }

  // Espacio para futuros campos editables: telefono, activo, etc.
  // Por ahora solo fecha_ingreso. Si update queda vacío, error.
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('socios')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 });

  return NextResponse.json({ socio: data });
}
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add app/api/socios/[id]/route.ts
git commit -m "feat(api): PATCH /api/socios/[id] con fecha_ingreso"
```

---

## Task 9: Cargar `ajustes` en endpoints existentes

**Files:**
- Modify: `app/api/cron/resumen-morosos/route.ts`
- Modify: `app/dashboard/page.tsx`
- Modify: `app/socios/page.tsx`

- [ ] **Step 1: Cron resumen-morosos**

En `app/api/cron/resumen-morosos/route.ts`, modificar el bloque que carga datos para incluir `ajustes_cuota` y pasarlo a `calcularDashboard`:

```ts
  const supabase = await createSupabaseServer();
  const [sociosRes, movsRes, cuotasRes, ajustesRes] = await Promise.all([
    supabase.from('socios').select('*'),
    supabase.from('movimientos').select('*'),
    supabase.from('cuotas_config').select('*'),
    supabase.from('ajustes_cuota').select('*'),
  ]);

  const socios = (sociosRes.data ?? []) as Socio[];
  const movimientos = (movsRes.data ?? []) as Movimiento[];
  const cuotas = (cuotasRes.data ?? []) as CuotaConfig[];
  const ajustes = (ajustesRes.data ?? []) as AjusteCuota[];

  const summary = calcularDashboard(socios, movimientos, cuotas, ajustes);
```

Y al import de tipos: `type AjusteCuota` además de los existentes.

- [ ] **Step 2: Dashboard server component**

En `app/dashboard/page.tsx`, replicar el patrón: agregar `supabase.from('ajustes_cuota').select('*')` al `Promise.all`, parsear como `AjusteCuota[]` y pasar a `calcularDashboard`.

- [ ] **Step 3: Listado de socios**

En `app/socios/page.tsx`, igual: cargar ajustes y pasarlos a `calcularEstado` cuando se calcula el estado de cada socio.

- [ ] **Step 4: Build + test**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: todo verde.

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/resumen-morosos/route.ts app/dashboard/page.tsx app/socios/page.tsx
git commit -m "feat(api+ui): propagar ajustes_cuota al cálculo en endpoints existentes"
```

---

## Task 10: Cargar y propagar `ajustes` en `/socios/[id]/page.tsx`

**Files:**
- Modify: `app/socios/[id]/page.tsx`

- [ ] **Step 1: Cargar ajustes en el server component**

Agregar al `Promise.all` del server component:

```ts
  const [socioRes, movsRes, cuotasRes, ajustesRes] = await Promise.all([
    supabase.from('socios').select('*').eq('id', id).single(),
    supabase.from('movimientos').select('*').eq('socio_id', id).order('fecha_registro', { ascending: false }),
    supabase.from('cuotas_config').select('*'),
    supabase.from('ajustes_cuota').select('*').eq('socio_id', id),
  ]);
```

Después del parseo:

```ts
  const ajustes = (ajustesRes.data ?? []) as AjusteCuota[];
  const estado = calcularEstado(socio, movimientos, cuotas, ajustes);
```

Agregar `AjusteCuota` al import de `@/lib/supabase`.

- [ ] **Step 2: Build + test**

```bash
npx tsc --noEmit && npm run build
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/socios/[id]/page.tsx
git commit -m "feat(socio detail): cargar ajustes_cuota y honrar en cálculo"
```

---

## Task 11: UI — extraer detalle del socio a Client Component

**Files:**
- Create: `app/socios/[id]/socio-detail-client.tsx`
- Modify: `app/socios/[id]/page.tsx`

- [ ] **Step 1: Crear el Client Component con la UI actual + nuevos botones (sin lógica aún)**

Crear `app/socios/[id]/socio-detail-client.tsx`. Mover el JSX que hoy está en `page.tsx` (todo lo que está dentro de `<div className="min-h-screen bg-paper">`) al cliente. Recibir props con `socio`, `movimientos`, `cuotas`, `ajustes`, `estado` y la sesión.

Encabezado del componente:

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Socio, Movimiento, CuotaConfig, AjusteCuota } from '@/lib/supabase';
import { calcularEstado, formatCLP, formatMes, ultimosMeses } from '@/lib/movimientos';
import { formatRut } from '@/lib/rut';
import { Navbar } from '@/components/navbar';

type Props = {
  socio: Socio;
  movimientos: Movimiento[];
  cuotas: CuotaConfig[];
  ajustes: AjusteCuota[];
  sessionNombre: string;
};

export function SocioDetailClient({ socio: socioInicial, movimientos, cuotas, ajustes: ajustesIniciales, sessionNombre }: Props) {
  const [socio, setSocio] = useState(socioInicial);
  const [ajustes, setAjustes] = useState(ajustesIniciales);
  // ... resto: estado calculado en runtime para que reaccione a setAjustes/setSocio
  const estado = calcularEstado(socio, movimientos, cuotas, ajustes);
  const initials = socio.nombre.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const totalPagado = movimientos
    .filter((m) => m.tipo === 'pago_cuota' || m.tipo === 'pago_extra')
    .reduce((s, m) => s + Number(m.monto), 0);

  return (
    <div className="min-h-screen bg-paper">
      <Navbar nombre={sessionNombre} />
      {/* TODO: pegar aquí el JSX migrado y mantener visualmente igual */}
    </div>
  );
}
```

Mover las 175 líneas de `page.tsx` (el `return` completo) dentro del `return` de este componente. Reemplazar referencias `session.nombre` por `sessionNombre`. Dejar marcadores `{/* AJUSTES UI */}` donde se inyectarán los nuevos elementos en tareas siguientes.

- [ ] **Step 2: Reescribir `page.tsx` para usar el cliente**

```tsx
// app/socios/[id]/page.tsx
import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { createSupabaseServer, type Socio, type Movimiento, type CuotaConfig, type AjusteCuota } from '@/lib/supabase';
import { SocioDetailClient } from './socio-detail-client';

export const dynamic = 'force-dynamic';

export default async function SocioDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const { id } = await params;
  const supabase = await createSupabaseServer();

  const [socioRes, movsRes, cuotasRes, ajustesRes] = await Promise.all([
    supabase.from('socios').select('*').eq('id', id).single(),
    supabase.from('movimientos').select('*').eq('socio_id', id).order('fecha_registro', { ascending: false }),
    supabase.from('cuotas_config').select('*'),
    supabase.from('ajustes_cuota').select('*').eq('socio_id', id),
  ]);

  if (socioRes.error || !socioRes.data) notFound();

  return (
    <SocioDetailClient
      socio={socioRes.data as Socio}
      movimientos={(movsRes.data ?? []) as Movimiento[]}
      cuotas={(cuotasRes.data ?? []) as CuotaConfig[]}
      ajustes={(ajustesRes.data ?? []) as AjusteCuota[]}
      sessionNombre={session.nombre}
    />
  );
}
```

- [ ] **Step 3: Build + verificación visual**

```bash
npx tsc --noEmit && npm run build
```

En dev, abrir `/socios/<algún_id>` y confirmar que la página se ve igual que antes.

- [ ] **Step 4: Commit**

```bash
git add app/socios/[id]/
git commit -m "refactor(socio detail): extraer client component sin cambios visuales"
```

---

## Task 12: UI — editar `fecha_ingreso` desde el header

**Files:**
- Modify: `app/socios/[id]/socio-detail-client.tsx`

- [ ] **Step 1: Agregar estado del modal y handler**

En `SocioDetailClient`, agregar arriba del `return`:

```tsx
  const [editandoFecha, setEditandoFecha] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState(socio.fecha_ingreso);
  const [guardandoFecha, setGuardandoFecha] = useState(false);

  async function guardarFechaIngreso() {
    if (!confirm('Cambiar la fecha de ingreso afecta el cálculo histórico de morosidad. ¿Continuar?')) return;
    setGuardandoFecha(true);
    try {
      const r = await fetch(`/api/socios/${socio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_ingreso: nuevaFecha }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error guardando');
      setSocio(j.socio);
      setEditandoFecha(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardandoFecha(false);
    }
  }
```

- [ ] **Step 2: Reemplazar el span "Ingresó <fecha>" por un botón editable**

Buscar el span que renderiza la fecha de ingreso y reemplazar por:

```tsx
              {!editandoFecha ? (
                <button
                  type="button"
                  onClick={() => { setNuevaFecha(socio.fecha_ingreso); setEditandoFecha(true); }}
                  className="text-sm text-ink-soft hover:text-verde underline-offset-2 hover:underline"
                  title="Editar fecha de ingreso"
                >
                  Ingresó {new Date(socio.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                </button>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <input
                    type="date"
                    value={nuevaFecha}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    className="border border-line rounded px-2 py-1 text-sm font-mono"
                    disabled={guardandoFecha}
                  />
                  <button onClick={guardarFechaIngreso} disabled={guardandoFecha} className="btn btn-primary text-xs px-3 py-1">
                    {guardandoFecha ? '…' : 'Guardar'}
                  </button>
                  <button onClick={() => setEditandoFecha(false)} disabled={guardandoFecha} className="btn btn-ghost text-xs px-3 py-1">
                    Cancelar
                  </button>
                </span>
              )}
```

- [ ] **Step 3: Probar manualmente**

`npm run dev` → abrir `/socios/<id>` → click en "Ingresó <fecha>" → editar → guardar → confirmar que la página refleja la fecha nueva inmediatamente y que `calcularEstado` reacciona.

- [ ] **Step 4: Commit**

```bash
git add app/socios/[id]/socio-detail-client.tsx
git commit -m "feat(ui): editar fecha_ingreso desde detalle del socio"
```

---

## Task 13: UI — modal de ajuste por mes

**Files:**
- Modify: `app/socios/[id]/socio-detail-client.tsx`

- [ ] **Step 1: Agregar estado y handler del modal de ajuste**

En `SocioDetailClient`, agregar:

```tsx
  type ModalState = { mes: string; cuotaGlobal: number; existente: AjusteCuota | null } | null;
  const [modalAjuste, setModalAjuste] = useState<ModalState>(null);
  const [montoInput, setMontoInput] = useState('');
  const [glosaInput, setGlosaInput] = useState('');
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  function abrirModalAjuste(mes: string) {
    const cuota = cuotas.find((c) => c.mes === mes);
    const existente = ajustes.find((a) => a.mes === mes) ?? null;
    setMontoInput(existente ? String(existente.monto) : String(cuota?.monto ?? 0));
    setGlosaInput(existente?.glosa ?? '');
    setModalAjuste({ mes, cuotaGlobal: cuota?.monto ?? 0, existente });
  }

  async function guardarAjuste() {
    if (!modalAjuste) return;
    if (glosaInput.trim().length === 0) { alert('Glosa obligatoria'); return; }
    const monto = Number(montoInput);
    if (!Number.isFinite(monto) || monto < 0) { alert('Monto inválido'); return; }

    setGuardandoAjuste(true);
    try {
      const r = await fetch('/api/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socio_id: socio.id, mes: modalAjuste.mes, monto, glosa: glosaInput.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error guardando');
      // upsert: reemplazar o agregar
      setAjustes((prev) => {
        const sin = prev.filter((a) => a.mes !== modalAjuste.mes);
        return [...sin, j.ajuste];
      });
      setModalAjuste(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardandoAjuste(false);
    }
  }

  async function eliminarAjuste() {
    if (!modalAjuste?.existente) return;
    if (!confirm('Eliminar este ajuste y volver al monto global de la cuota?')) return;
    setGuardandoAjuste(true);
    try {
      const r = await fetch(`/api/ajustes?id=${encodeURIComponent(modalAjuste.existente.id)}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || 'Error eliminando');
      }
      setAjustes((prev) => prev.filter((a) => a.id !== modalAjuste.existente!.id));
      setModalAjuste(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardandoAjuste(false);
    }
  }
```

- [ ] **Step 2: Hacer los badges de meses adeudados clickeables**

Buscar el bloque que renderiza `{estado.mesesAdeudados.map((mes) => ( <span ... > ))}` y reemplazar el `<span>` por `<button onClick={() => abrirModalAjuste(mes)} className="...">`. Mantener el mismo styling visual.

- [ ] **Step 3: Agregar un botón "Ajustar otro mes"**

Junto al panel de meses pendientes, agregar:

```tsx
<div className="mt-3">
  <select
    onChange={(e) => { if (e.target.value) { abrirModalAjuste(e.target.value); e.target.value = ''; } }}
    className="border border-line rounded px-2 py-1 text-xs font-mono"
    defaultValue=""
  >
    <option value="" disabled>Ajustar otro mes…</option>
    {ultimosMeses(36).map((m) => (
      <option key={m} value={m}>{formatMes(m)}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 4: Renderizar el modal al final del componente, antes del cierre del root div**

```tsx
      {modalAjuste && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[420px] max-w-full">
            <h2 className="font-display text-xl font-medium text-bosque mb-1">
              Ajustar cuota de <em className="italic text-verde">{formatMes(modalAjuste.mes)}</em>
            </h2>
            <p className="text-xs text-muted mb-4">Cuota global del mes: {formatCLP(modalAjuste.cuotaGlobal)}</p>

            <label className="block text-xs font-mono text-ink-soft mb-1">Monto adeudado por este socio</label>
            <input
              type="number"
              min={0}
              step={1}
              value={montoInput}
              onChange={(e) => setMontoInput(e.target.value)}
              className="w-full border border-line rounded px-3 py-2 mb-3 font-mono"
              disabled={guardandoAjuste}
            />
            <p className="text-[11px] text-muted -mt-2 mb-3">Pone 0 para anular la deuda de este mes.</p>

            <label className="block text-xs font-mono text-ink-soft mb-1">Glosa (obligatoria)</label>
            <textarea
              value={glosaInput}
              onChange={(e) => setGlosaInput(e.target.value)}
              rows={3}
              className="w-full border border-line rounded px-3 py-2 mb-4"
              placeholder="Ej: lesión hasta dic 2025; beca media por situación familiar; etc."
              disabled={guardandoAjuste}
            />

            <div className="flex justify-between gap-2">
              {modalAjuste.existente ? (
                <button onClick={eliminarAjuste} disabled={guardandoAjuste} className="btn btn-ghost text-xs px-3 py-2 text-rojo">
                  Eliminar ajuste
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <button onClick={() => setModalAjuste(null)} disabled={guardandoAjuste} className="btn btn-ghost text-xs px-3 py-2">
                  Cancelar
                </button>
                <button onClick={guardarAjuste} disabled={guardandoAjuste} className="btn btn-primary text-xs px-3 py-2">
                  {guardandoAjuste ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 5: Probar manualmente**

`npm run dev` → abrir `/socios/<id de un moroso>` → click en uno de los badges rojos → completar monto y glosa → guardar → verificar que la deuda baja al instante.

- [ ] **Step 6: Commit**

```bash
git add app/socios/[id]/socio-detail-client.tsx
git commit -m "feat(ui): modal de ajuste de cuota por mes (crear/editar/eliminar)"
```

---

## Task 14: UI — bulk de ajustes

**Files:**
- Modify: `app/socios/[id]/socio-detail-client.tsx`

- [ ] **Step 1: Agregar estado y handler del modal bulk**

```tsx
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDesde, setBulkDesde] = useState('');
  const [bulkHasta, setBulkHasta] = useState('');
  const [bulkMonto, setBulkMonto] = useState('0');
  const [bulkGlosa, setBulkGlosa] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  async function guardarBulk() {
    if (!bulkDesde || !bulkHasta) { alert('Selecciona ambos meses'); return; }
    if (bulkHasta < bulkDesde) { alert('mes_hasta debe ser >= mes_desde'); return; }
    if (bulkGlosa.trim().length === 0) { alert('Glosa obligatoria'); return; }
    const monto = Number(bulkMonto);
    if (!Number.isFinite(monto) || monto < 0) { alert('Monto inválido'); return; }

    setBulkSaving(true);
    try {
      const r = await fetch('/api/ajustes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socio_id: socio.id,
          mes_desde: bulkDesde,
          mes_hasta: bulkHasta,
          monto,
          glosa: bulkGlosa.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error guardando');
      // Reemplazar todos los ajustes del rango con los nuevos.
      setAjustes((prev) => {
        const fueraDelRango = prev.filter((a) => a.mes < bulkDesde || a.mes > bulkHasta);
        return [...fueraDelRango, ...(j.ajustes as AjusteCuota[])];
      });
      setBulkOpen(false);
      setBulkDesde(''); setBulkHasta(''); setBulkMonto('0'); setBulkGlosa('');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBulkSaving(false);
    }
  }
```

- [ ] **Step 2: Agregar botón "Aplicar ajuste a varios meses" en el header del socio**

En el bloque del header, junto al botón de exportar, agregar:

```tsx
<button onClick={() => setBulkOpen(true)} className="btn btn-ghost text-xs px-3.5 py-2">
  Ajuste por rango…
</button>
```

- [ ] **Step 3: Renderizar modal bulk al final del componente**

```tsx
      {bulkOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-[460px] max-w-full">
            <h2 className="font-display text-xl font-medium text-bosque mb-1">
              Ajuste por rango — <em className="italic text-verde">{socio.nombre}</em>
            </h2>
            <p className="text-xs text-muted mb-4">Crea un ajuste con el mismo monto y glosa para todos los meses del rango. Reemplaza ajustes existentes.</p>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-mono text-ink-soft mb-1">Mes desde</label>
                <select value={bulkDesde} onChange={(e) => setBulkDesde(e.target.value)} className="w-full border border-line rounded px-2 py-2 text-sm font-mono" disabled={bulkSaving}>
                  <option value="">—</option>
                  {ultimosMeses(48).map((m) => <option key={m} value={m}>{formatMes(m)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-ink-soft mb-1">Mes hasta</label>
                <select value={bulkHasta} onChange={(e) => setBulkHasta(e.target.value)} className="w-full border border-line rounded px-2 py-2 text-sm font-mono" disabled={bulkSaving}>
                  <option value="">—</option>
                  {ultimosMeses(48).map((m) => <option key={m} value={m}>{formatMes(m)}</option>)}
                </select>
              </div>
            </div>

            <label className="block text-xs font-mono text-ink-soft mb-1">Monto por mes</label>
            <input type="number" min={0} value={bulkMonto} onChange={(e) => setBulkMonto(e.target.value)} className="w-full border border-line rounded px-3 py-2 mb-3 font-mono" disabled={bulkSaving} />

            <label className="block text-xs font-mono text-ink-soft mb-1">Glosa</label>
            <textarea value={bulkGlosa} onChange={(e) => setBulkGlosa(e.target.value)} rows={3} className="w-full border border-line rounded px-3 py-2 mb-4" disabled={bulkSaving} />

            <div className="flex justify-end gap-2">
              <button onClick={() => setBulkOpen(false)} disabled={bulkSaving} className="btn btn-ghost text-xs px-3 py-2">Cancelar</button>
              <button onClick={guardarBulk} disabled={bulkSaving} className="btn btn-primary text-xs px-3 py-2">
                {bulkSaving ? 'Guardando…' : 'Crear ajustes'}
              </button>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Probar manualmente — caso Patricio**

`npm run dev` → abrir socio Patricio Lagos → click "Ajuste por rango" → desde ago 2024, hasta abr 2026, monto 0, glosa "se cambió de ciudad post-fundación" → guardar → su deuda debe pasar a $0.

- [ ] **Step 5: Commit**

```bash
git add app/socios/[id]/socio-detail-client.tsx
git commit -m "feat(ui): ajuste por rango (bulk) en detalle del socio"
```

---

## Task 15: UI — vista pública `/mi/[rut]`

**Files:**
- Modify: `app/mi/[rut]/page.tsx`

- [ ] **Step 1: Cargar ajustes y honrar en el cálculo**

Agregar a la carga inicial del server component:

```ts
  const [socioRes, movsRes, cuotasRes, ajustesRes] = await Promise.all([
    /* ... existentes ... */,
    supabase.from('ajustes_cuota').select('*').eq('socio_id', /* id del socio */),
  ]);
  const ajustes = (ajustesRes.data ?? []) as AjusteCuota[];
```

(El RUT se traduce a `socio_id` con la query existente. Si la consulta de ajustes necesita el id, hacer un segundo `await` después de tener `socio.id`.)

Luego pasar `ajustes` a `calcularEstado`. Importar `AjusteCuota` de `@/lib/supabase`.

- [ ] **Step 2: Mostrar badge "ajustado" en los meses afectados**

Donde la página renderiza la grilla mes-a-mes (o lista similar), agregar un badge sutil en los meses que tengan ajuste vigente:

```tsx
{ajustePorMes.has(mes) && (
  <span className="ml-1 text-[10px] uppercase tracking-wider text-kayak-deep bg-kayak-soft rounded px-1">
    ajustado
  </span>
)}
```

(`ajustePorMes` = `new Map(ajustes.map((a) => [a.mes, a]))` calculado al inicio del componente.)

**No** mostrar la glosa al socio (decisión del spec §3).

- [ ] **Step 3: Build y verificación**

```bash
npm run build
```

Abrir en dev `/mi/<rut>` de un socio con ajustes; confirmar que aparece el badge "ajustado" sin glosa.

- [ ] **Step 4: Commit**

```bash
git add app/mi/[rut]/page.tsx
git commit -m "feat(ui): vista pública /mi muestra badge ajustado sin glosa"
```

---

## Task 16: Verificación end-to-end + actualización de PROGRESO.md

**Files:**
- Modify: `PROGRESO.md`

- [ ] **Step 1: Aplicar el caso Patricio en producción**

Vía la UI (en `https://clubpm-kayak.vercel.app` después del próximo deploy automático), entrar a Patricio Lagos → "Ajuste por rango" → desde ago 2024 hasta dic 2027 (cubriendo holgado a futuro), monto 0, glosa "se cambió de ciudad post-fundación".

Disparar el cron y confirmar que Patricio ya no aparece:

```bash
curl -H "Authorization: Bearer feb5a71aa764becf204ca09f1caeaea764196f9c27d2cff1f6bbbba3c241c127" \
  https://clubpm-kayak.vercel.app/api/cron/resumen-morosos
```

Expected: `morosos` ya no incluye a Patricio.

- [ ] **Step 2: Aplicar el caso Juan**

Editar la `fecha_ingreso` de Juan Landaeta a su fecha real de integración (preguntar a Carlos si no la conocemos: posible jul-2025 según el array de meses adeudados que vimos). Verificar que sus 12 meses morosos desaparecen.

- [ ] **Step 3: Verificación final del estado de tests + build**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: todo verde.

- [ ] **Step 4: Actualizar `PROGRESO.md`**

- En la tabla §1, agregar fila nueva:

  | Ajustes de cuota por socio    | ✅ Listo   | Tabla `ajustes_cuota` con override por (socio, mes); UI individual + bulk; honrado en cálculo y cron |

- Cambiar fecha de la cabecera a la fecha real de finalización.
- Agregar §4 una sección Sprint 8 con el resumen del trabajo y los commits relevantes.
- Mover los ítems "Excepciones de cuota por socio" y "Editar/eliminar cuotas en /configuracion" del backlog §6 (el primero queda implementado; el segundo sigue pendiente como editar `cuotas_config` global, distinto de lo que hicimos).

- [ ] **Step 5: Commit y push final**

```bash
git add PROGRESO.md
git commit -m "docs(progreso): cierre Sprint 8 - ajustes de cuota por socio"
git push origin main
```

Vercel redeploya automáticamente. Verificar la URL pública con un curl al cron.

---

## Self-review (concluido antes de empezar la ejecución)

- ✅ Todas las secciones del spec tienen tarea asociada (BD §4 → T1; tipos §5.3 → T2; cálculo §5 → T3-T5; API §6 → T6-T8; carga en endpoints existentes §6.6 → T9-T10; UI §7 → T11-T15; reportes §8 → cubierto por T9; tests §9 → T3-T5; "listo" §10 → T16).
- ✅ Sin placeholders "TBD"/"TODO" en pasos.
- ✅ Firmas consistentes: `calcularEstado(s, m, c, a, ref)` y `calcularDashboard(s, m, c, a)` aparecen igual en T4, T5, T9, T10.
- ⚠️ Nota de divergencia con el spec: el spec dice "glosa = obligatoria" — el plan refuerza con check de SQL `length(trim(glosa)) > 0` y validación en endpoints. Coherente.
- ⚠️ Decisión de implementación: `creado_por` = `session.rut` (consistente con el spec §4.1; el archivo de movimientos usa `session.nombre` pero el spec dice "RUT del admin", primamos el spec).
