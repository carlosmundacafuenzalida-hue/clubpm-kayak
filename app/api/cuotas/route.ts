import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';
import { getSession } from '@/lib/session';

const MONTO_MAX = 200000;
const MES_PATTERN = /^\d{4}-\d{2}-01$/;

export async function GET() {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('cuotas_config')
    .select('*')
    .order('mes', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ cuotas: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const mes = body?.mes;
  const monto = Number(body?.monto);

  if (!mes || typeof mes !== 'string' || !MES_PATTERN.test(mes)) {
    return NextResponse.json(
      { error: 'Mes inválido. Formato esperado: YYYY-MM-01' },
      { status: 400 }
    );
  }
  if (!Number.isFinite(monto) || !Number.isInteger(monto) || monto <= 0) {
    return NextResponse.json(
      { error: 'El monto debe ser un entero positivo' },
      { status: 400 }
    );
  }
  if (monto > MONTO_MAX) {
    return NextResponse.json(
      { error: `El monto no puede exceder ${MONTO_MAX}` },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServer();

  const { data: existing } = await supabase
    .from('cuotas_config')
    .select('id')
    .eq('mes', mes)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `Ya existe una cuota configurada para ${mes}` },
      { status: 409 }
    );
  }

  const { data, error } = await supabase
    .from('cuotas_config')
    .insert({ mes, monto })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: `Ya existe una cuota configurada para ${mes}` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ cuota: data }, { status: 201 });
}
