import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createSupabaseServer, type Socio, type Movimiento } from '@/lib/supabase';
import { generarReporteSocio } from '@/lib/excel';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const supabase = await createSupabaseServer();

  const [socioRes, movsRes] = await Promise.all([
    supabase.from('socios').select('*').eq('id', id).single(),
    supabase
      .from('movimientos')
      .select('*')
      .eq('socio_id', id)
      .order('fecha_registro', { ascending: false }),
  ]);

  if (socioRes.error || !socioRes.data) {
    return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 });
  }

  const socio = socioRes.data as Socio;
  const movimientos = (movsRes.data ?? []) as Movimiento[];

  const buffer = await generarReporteSocio(socio, movimientos);
  const fecha = new Date().toISOString().slice(0, 10);
  const slug = socio.nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40) || 'socio';

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="historial-${slug}-${fecha}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
