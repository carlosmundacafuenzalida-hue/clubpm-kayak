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
