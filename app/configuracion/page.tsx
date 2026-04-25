import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { createSupabaseServer, type CuotaConfig } from '@/lib/supabase';
import { Navbar } from '@/components/navbar';
import { ConfiguracionClient } from './configuracion-client';

export const dynamic = 'force-dynamic';

export default async function ConfiguracionPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from('cuotas_config')
    .select('*')
    .order('mes', { ascending: false });

  return (
    <div className="min-h-screen bg-paper">
      <Navbar nombre={session.nombre} />
      <ConfiguracionClient cuotas={(data ?? []) as CuotaConfig[]} />
    </div>
  );
}
