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
