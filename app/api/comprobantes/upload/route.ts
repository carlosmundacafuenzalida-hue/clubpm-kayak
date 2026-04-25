import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';
import { getSession } from '@/lib/session';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_SIZE = 5 * 1024 * 1024;
const BUCKET = 'comprobantes';

function sanitizeFilename(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'archivo';
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10);
  return safeBase + safeExt;
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'FormData inválido' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Falta archivo' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: 'Tipo no permitido. Solo JPG, PNG o PDF.' },
      { status: 400 }
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo excede 5MB' }, { status: 400 });
  }

  const safeName = sanitizeFilename(file.name || 'archivo');
  const path = `${session.socio_id}_${Date.now()}_${safeName}`;

  const supabase = await createSupabaseServer();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: signed, error: sigErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (sigErr) {
    return NextResponse.json({ error: sigErr.message }, { status: 500 });
  }

  return NextResponse.json({ path, url: signed.signedUrl }, { status: 201 });
}
