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
    .from('movimientos')
    .select('*')
    .order('fecha_registro', { ascending: false })
    .limit(500);
  if (socioId) q = q.eq('socio_id', socioId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ movimientos: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const tipo = body?.tipo;
  const socioId = body?.socio_id;
  const monto = Number(body?.monto);

  if (!tipo || !socioId || !monto || monto <= 0) {
    return NextResponse.json({ error: 'Faltan campos o monto inválido' }, { status: 400 });
  }
  if (!['pago_cuota', 'pago_extra', 'cargo', 'ajuste'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo de movimiento inválido' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const insert = {
    tipo,
    socio_id: socioId,
    mes_cuota: tipo === 'pago_cuota' ? body.mes_cuota : null,
    monto,
    glosa: String(body.glosa ?? '').trim() || `${tipo} registrado`,
    comprobante_url: body.comprobante_url ?? null,
    fecha_registro: body.fecha_registro ?? new Date().toISOString().slice(0, 10),
    creado_por: session.nombre,
  };

  const { data, error } = await supabase
    .from('movimientos')
    .insert(insert)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ movimiento: data }, { status: 201 });
}
