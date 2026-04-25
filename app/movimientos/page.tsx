import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { createSupabaseServer, type Socio, type Movimiento, type CuotaConfig } from '@/lib/supabase';
import { Navbar } from '@/components/navbar';
import { MovimientosClient } from './movimientos-client';

export const dynamic = 'force-dynamic';

export default async function MovimientosPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const supabase = await createSupabaseServer();
  const [sociosRes, movsRes, cuotasRes] = await Promise.all([
    supabase.from('socios').select('*').eq('activo', true).order('nombre'),
    supabase.from('movimientos').select('*').order('fecha_registro', { ascending: false }).limit(200),
    supabase.from('cuotas_config').select('*').order('mes', { ascending: false }),
  ]);

  return (
    <div className="min-h-screen bg-paper">
      <Navbar nombre={session.nombre} />
      <MovimientosClient
        socios={(sociosRes.data ?? []) as Socio[]}
        movimientos={(movsRes.data ?? []) as Movimiento[]}
        cuotas={(cuotasRes.data ?? []) as CuotaConfig[]}
      />
    </div>
  );
}
