import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/session';
import { createSupabaseServer, type Socio, type Movimiento, type CuotaConfig, type AjusteCuota } from '@/lib/supabase';
import { SocioDetailClient } from './socio-detail-client';

export const dynamic = 'force-dynamic';

export default async function SocioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  const supabase = await createSupabaseServer();

  const [socioRes, movsRes, cuotasRes, ajustesRes] = await Promise.all([
    supabase.from('socios').select('*').eq('id', id).single(),
    supabase.from('movimientos').select('*').eq('socio_id', id).order('fecha_registro', { ascending: false }),
    supabase.from('cuotas_config').select('*'),
    supabase.from('ajustes_cuota').select('*').eq('socio_id', id),
  ]);

  if (socioRes.error || !socioRes.data) notFound();

  return (
    <SocioDetailClient
      socio={socioRes.data as Socio}
      movimientos={(movsRes.data ?? []) as Movimiento[]}
      cuotas={(cuotasRes.data ?? []) as CuotaConfig[]}
      ajustes={(ajustesRes.data ?? []) as AjusteCuota[]}
      sessionNombre={session.nombre}
    />
  );
}
