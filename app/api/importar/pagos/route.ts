import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createSupabaseServer } from '@/lib/supabase';
import { isValidRut, normalizeRut } from '@/lib/rut';
import { formatMes } from '@/lib/movimientos';

export const dynamic = 'force-dynamic';

type PagoInput = {
  rut: unknown;
  mes: unknown;
  monto: unknown;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const entradas: PagoInput[] = Array.isArray(body?.pagos) ? body.pagos : [];
  if (entradas.length === 0) {
    return NextResponse.json({ error: 'Lista vacía' }, { status: 400 });
  }

  let errores = 0;
  type Limpio = { rut: string; mes: string; monto: number };
  const limpios: Limpio[] = [];

  for (const e of entradas) {
    const rutRaw = String(e.rut ?? '').trim();
    const mes = String(e.mes ?? '').trim();
    const monto = Number(e.monto);
    if (!isValidRut(rutRaw) || !/^\d{4}-\d{2}-01$/.test(mes) || !Number.isFinite(monto) || monto <= 0) {
      errores++;
      continue;
    }
    limpios.push({ rut: normalizeRut(rutRaw), mes, monto });
  }

  if (limpios.length === 0) {
    return NextResponse.json({ creados: 0, sin_socio: 0, errores });
  }

  const supabase = await createSupabaseServer();

  // Mapa rut → id de socio para todos los RUTs del archivo
  const rutsUnicos = Array.from(new Set(limpios.map((l) => l.rut)));
  const { data: socios } = await supabase
    .from('socios')
    .select('id, rut')
    .in('rut', rutsUnicos);
  const rutAId = new Map((socios ?? []).map((s: { id: string; rut: string }) => [s.rut, s.id]));

  let sin_socio = 0;
  const movimientos: Array<{
    tipo: 'pago_cuota';
    socio_id: string;
    mes_cuota: string;
    monto: number;
    glosa: string;
    fecha_registro: string;
    creado_por: string;
  }> = [];
  const hoy = new Date().toISOString().slice(0, 10);

  for (const p of limpios) {
    const socioId = rutAId.get(p.rut);
    if (!socioId) {
      sin_socio++;
      continue;
    }
    movimientos.push({
      tipo: 'pago_cuota',
      socio_id: socioId,
      mes_cuota: p.mes,
      monto: p.monto,
      glosa: `Importación masiva — ${formatMes(p.mes)}`,
      fecha_registro: hoy,
      creado_por: session.nombre,
    });
  }

  if (movimientos.length === 0) {
    return NextResponse.json({ creados: 0, sin_socio, errores });
  }

  const { data, error } = await supabase
    .from('movimientos')
    .insert(movimientos)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ creados: data?.length ?? 0, sin_socio, errores });
}
