import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';
import { getSession } from '@/lib/session';
import { isValidRut, normalizeRut } from '@/lib/rut';

export async function GET() {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('socios')
    .select('*')
    .order('nombre', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ socios: data });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  if (!body?.rut || !body?.nombre) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }
  if (!isValidRut(body.rut)) {
    return NextResponse.json({ error: 'RUT inválido' }, { status: 400 });
  }

  const supabase = await createSupabaseServer();
  const insert = {
    rut: normalizeRut(body.rut),
    nombre: String(body.nombre).trim(),
    telefono: body.telefono ? String(body.telefono).replace(/\D/g, '') : null,
    fecha_ingreso: body.fecha_ingreso ?? new Date().toISOString().slice(0, 10),
    activo: true,
    es_admin: false,
    pin_hash: null,
  };

  const { data, error } = await supabase
    .from('socios')
    .insert(insert)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Ya existe un socio con ese RUT' }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ socio: data }, { status: 201 });
}
