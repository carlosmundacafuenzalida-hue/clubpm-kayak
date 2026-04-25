import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { Navbar } from '@/components/navbar';
import { ImportarClient } from './importar-client';

export const dynamic = 'force-dynamic';

export default async function ImportarPage() {
  const session = await getSession();
  if (!session?.es_admin) redirect('/login');

  return (
    <div className="min-h-screen bg-paper">
      <Navbar nombre={session.nombre} />
      <ImportarClient />
    </div>
  );
}
