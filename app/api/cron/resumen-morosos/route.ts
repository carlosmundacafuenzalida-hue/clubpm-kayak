import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer, type Socio, type Movimiento, type CuotaConfig } from '@/lib/supabase';
import { calcularDashboard, formatCLP, formatMes } from '@/lib/movimientos';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'CRON_SECRET no configurado' }, { status: 500 });
  }

  const provided = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (provided !== expected) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const supabase = await createSupabaseServer();
  const [sociosRes, movsRes, cuotasRes] = await Promise.all([
    supabase.from('socios').select('*'),
    supabase.from('movimientos').select('*'),
    supabase.from('cuotas_config').select('*'),
  ]);

  const socios = (sociosRes.data ?? []) as Socio[];
  const movimientos = (movsRes.data ?? []) as Movimiento[];
  const cuotas = (cuotasRes.data ?? []) as CuotaConfig[];

  const summary = calcularDashboard(socios, movimientos, cuotas, []);

  if (summary.morosos === 0) {
    return NextResponse.json({
      morosos: 0,
      total_adeudado: 0,
      mensaje: 'No hay morosos. ¡Todos al día!',
      admin_url: null,
      detalle: [],
    });
  }

  const totalAdeudado = summary.morososDetalle.reduce((s, m) => s + m.montoAdeudado, 0);

  const lineas = summary.morososDetalle.map((m) => {
    const primero = m.mesesAdeudados[0];
    return `• ${m.socio.nombre} — ${m.mesesAdeudados.length} mes(es) desde ${formatMes(primero)} — ${formatCLP(m.montoAdeudado)}`;
  });

  const mensaje = [
    `🛶 Club PM Kayak — Resumen de morosos`,
    `Fecha: ${new Date().toLocaleDateString('es-CL')}`,
    '',
    `${summary.morosos} socio${summary.morosos === 1 ? '' : 's'} con cuotas pendientes`,
    `Total adeudado: ${formatCLP(totalAdeudado)}`,
    '',
    ...lineas,
  ].join('\n');

  const adminTelefono = process.env.ADMIN_TELEFONO;
  const adminUrl = adminTelefono
    ? `https://wa.me/${adminTelefono}?text=${encodeURIComponent(mensaje)}`
    : null;

  return NextResponse.json({
    morosos: summary.morosos,
    total_adeudado: totalAdeudado,
    mensaje,
    admin_url: adminUrl,
    detalle: summary.morososDetalle.map((m) => ({
      socio_id: m.socio.id,
      nombre: m.socio.nombre,
      meses: m.mesesAdeudados,
      monto: m.montoAdeudado,
    })),
  });
}
