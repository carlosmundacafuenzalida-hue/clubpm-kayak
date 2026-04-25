import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createSupabaseServer, type Movimiento } from '@/lib/supabase';
import { generarReporteRecaudacion } from '@/lib/excel';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const mesesParam = req.nextUrl.searchParams.get('meses');
  const parsed = mesesParam ? parseInt(mesesParam, 10) : 12;
  const meses = Number.isFinite(parsed) && parsed > 0 && parsed <= 60 ? parsed : 12;

  const supabase = await createSupabaseServer();
  const { data } = await supabase.from('movimientos').select('*');
  const movimientos = (data ?? []) as Movimiento[];

  const buffer = await generarReporteRecaudacion(movimientos, meses);
  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte-recaudacion-${fecha}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
