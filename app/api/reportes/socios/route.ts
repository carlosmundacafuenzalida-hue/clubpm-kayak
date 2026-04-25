import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createSupabaseServer, type Socio, type Movimiento, type CuotaConfig } from '@/lib/supabase';
import { generarReporteSocios } from '@/lib/excel';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = await createSupabaseServer();
  const [sociosRes, movsRes, cuotasRes] = await Promise.all([
    supabase.from('socios').select('*').order('nombre'),
    supabase.from('movimientos').select('*'),
    supabase.from('cuotas_config').select('*'),
  ]);

  const socios = (sociosRes.data ?? []) as Socio[];
  const movimientos = (movsRes.data ?? []) as Movimiento[];
  const cuotas = (cuotasRes.data ?? []) as CuotaConfig[];

  const buffer = await generarReporteSocios(socios, movimientos, cuotas);
  const fecha = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="reporte-socios-${fecha}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
