import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';
import { getSession } from '@/lib/session';

const BUCKET = 'comprobantes';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { path } = await params;

  // Next.js ya decodificó el segmento. Bloqueamos cualquier intento de path traversal
  // o subdirectorios — los comprobantes se guardan en la raíz del bucket.
  if (!path || path.includes('/') || path.includes('\\') || path.includes('..')) {
    return NextResponse.json({ error: 'Path inválido' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error || !data?.signedUrl) {
    return NextResponse.json(
      { error: error?.message ?? 'No se pudo generar la URL firmada' },
      { status: 500 }
    );
  }

  return NextResponse.redirect(data.signedUrl);
}
