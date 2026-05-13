import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { createSupabaseServer, type Socio, type Movimiento, type CuotaConfig } from '@/lib/supabase';
import { calcularEstado, mesActual } from '@/lib/movimientos';
import { Navbar } from '@/components/navbar';
import { SociosClient } from './socios-client';

export const dynamic = 'force-dynamic';

export default async function SociosPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const supabase = await createSupabaseServer();
  const [sociosRes, movsRes, cuotasRes] = await Promise.all([
    supabase.from('socios').select('*').order('nombre'),
    supabase.from('movimientos').select('*'),
    supabase.from('cuotas_config').select('*'),
  ]);

  const socios = (sociosRes.data ?? []) as Socio[];
  const movimientos = (movsRes.data ?? []) as Movimiento[];
  const cuotas = (cuotasRes.data ?? []) as CuotaConfig[];
  const mes = mesActual();

  // Para cada socio calculamos su estado
  const sociosConEstado = socios.map((s) => {
    const r = calcularEstado(s, movimientos, cuotas, [], mes);
    const ultimoPago = movimientos
      .filter((m) => m.socio_id === s.id && m.tipo === 'pago_cuota')
      .sort((a, b) => b.fecha_registro.localeCompare(a.fecha_registro))[0];
    return {
      ...s,
      estado: r.estado,
      mesesAdeudados: r.mesesAdeudados,
      montoAdeudado: r.montoAdeudado,
      ultimo_pago: ultimoPago?.fecha_registro ?? null,
    };
  });

  return (
    <div className="min-h-screen bg-paper">
      <Navbar nombre={session.nombre} />
      <SociosClient socios={sociosConEstado} />
    </div>
  );
}
