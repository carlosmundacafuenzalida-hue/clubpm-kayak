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
