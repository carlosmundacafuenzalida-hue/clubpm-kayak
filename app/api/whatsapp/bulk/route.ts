import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createSupabaseServer, type Socio, type Movimiento, type CuotaConfig, type AjusteCuota } from '@/lib/supabase';
import { calcularEstado, formatCLP, formatMes } from '@/lib/movimientos';

type BulkUrl = {
  socio_id: string;
  nombre: string;
  telefono: string;
  url: string;
  monto: number;
  meses: string[];
};

type BulkSkipped = {
  socio_id: string;
  nombre: string;
  motivo: 'sin_telefono' | 'sin_deuda' | 'no_encontrado';
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const ids: unknown = body?.socio_ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'Falta socio_ids' }, { status: 400 });
  }
  const socioIds = ids.filter((x): x is string => typeof x === 'string');

  const supabase = await createSupabaseServer();
  const [sociosRes, movsRes, cuotasRes, ajustesRes] = await Promise.all([
    supabase.from('socios').select('*').in('id', socioIds),
    supabase.from('movimientos').select('*'),
    supabase.from('cuotas_config').select('*'),
    supabase.from('ajustes_cuota').select('*').in('socio_id', socioIds),
  ]);

  const socios = (sociosRes.data ?? []) as Socio[];
  const movimientos = (movsRes.data ?? []) as Movimiento[];
  const cuotas = (cuotasRes.data ?? []) as CuotaConfig[];
  const ajustes = (ajustesRes.data ?? []) as AjusteCuota[];

  const urls: BulkUrl[] = [];
  const skipped: BulkSkipped[] = [];

  for (const socioId of socioIds) {
    const socio = socios.find((s) => s.id === socioId);
    if (!socio) {
      skipped.push({ socio_id: socioId, nombre: '—', motivo: 'no_encontrado' });
      continue;
    }
    if (!socio.telefono) {
      skipped.push({ socio_id: socio.id, nombre: socio.nombre, motivo: 'sin_telefono' });
      continue;
    }

    const r = calcularEstado(socio, movimientos, cuotas, ajustes);
    if (r.mesesAdeudados.length === 0) {
      skipped.push({ socio_id: socio.id, nombre: socio.nombre, motivo: 'sin_deuda' });
      continue;
    }

    const mesesTexto = r.mesesAdeudados.map(formatMes).join(', ');
    const mensaje = [
      `Hola ${socio.nombre.split(' ')[0]}, te saluda el Club PM Kayak 🛶`,
      '',
      `Te recordamos que tienes pendiente el pago de la(s) cuota(s) de: ${mesesTexto}.`,
      r.montoAdeudado > 0 ? `Monto adeudado: ${formatCLP(r.montoAdeudado)}` : '',
      '',
      'Cualquier consulta avísame por aquí. ¡Gracias!',
    ].filter(Boolean).join('\n');

    urls.push({
      socio_id: socio.id,
      nombre: socio.nombre,
      telefono: socio.telefono,
      url: `https://wa.me/${socio.telefono}?text=${encodeURIComponent(mensaje)}`,
      monto: r.montoAdeudado,
      meses: r.mesesAdeudados,
    });
  }

  return NextResponse.json({ urls, skipped });
}
