import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { createSupabaseServer, type Socio, type Movimiento, type CuotaConfig } from '@/lib/supabase';
import { calcularDashboard, formatCLP } from '@/lib/movimientos';
import { Navbar } from '@/components/navbar';
import { DashboardClient } from './dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const supabase = await createSupabaseServer();

  const [sociosRes, movsRes, cuotasRes] = await Promise.all([
    supabase.from('socios').select('*'),
    supabase.from('movimientos').select('*').order('fecha_registro', { ascending: false }).limit(500),
    supabase.from('cuotas_config').select('*'),
  ]);

  const socios = (sociosRes.data ?? []) as Socio[];
  const movimientos = (movsRes.data ?? []) as Movimiento[];
  const cuotas = (cuotasRes.data ?? []) as CuotaConfig[];

  const summary = calcularDashboard(socios, movimientos, cuotas);

  // Últimos 3 movimientos para feed de actividad
  const actividadReciente = movimientos.slice(0, 5).map((m) => {
    const socio = socios.find((s) => s.id === m.socio_id);
    return {
      id: m.id,
      tipo: m.tipo,
      monto: Number(m.monto),
      fecha: m.fecha_registro,
      socio_nombre: socio?.nombre ?? '—',
      glosa: m.glosa,
    };
  });

  return (
    <div className="min-h-screen bg-paper">
      <Navbar nombre={session.nombre} />
      <DashboardClient
        nombre={session.nombre}
        summary={summary}
        actividad={actividadReciente}
      />
    </div>
  );
}
