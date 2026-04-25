import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase';
import { createSession } from '@/lib/session';
import { isValidRut, normalizeRut } from '@/lib/rut';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.rut || !body?.pin) {
    return NextResponse.json({ error: 'Faltan campos' }, { status: 400 });
  }

  const rutInput = String(body.rut);
  const pin = String(body.pin);

  if (!isValidRut(rutInput)) {
    return NextResponse.json({ error: 'RUT inválido' }, { status: 400 });
  }

  if (!/^\d{4,6}$/.test(pin)) {
    return NextResponse.json({ error: 'PIN inválido (4-6 dígitos)' }, { status: 400 });
  }

  const rut = normalizeRut(rutInput);
  const supabase = await createSupabaseServer();

  // Llamar a la función SQL verify_pin que comparamos en SQL (security definer).
  const { data: ok, error: rpcError } = await supabase.rpc('verify_pin', {
    p_rut: rut,
    p_pin: pin,
  });

  if (rpcError || !ok) {
    return NextResponse.json({ error: 'RUT o PIN incorrectos' }, { status: 401 });
  }

  // Recuperar datos del socio para guardar en la sesión.
  const { data: socio, error: selError } = await supabase
    .from('socios')
    .select('id, rut, nombre, es_admin, activo')
    .eq('rut', rut)
    .eq('es_admin', true)
    .eq('activo', true)
    .single();

  if (selError || !socio) {
    return NextResponse.json({ error: 'Socio no encontrado' }, { status: 401 });
  }

  await createSession({
    socio_id: socio.id,
    rut: socio.rut,
    nombre: socio.nombre,
    es_admin: socio.es_admin,
  });

  return NextResponse.json({ ok: true, nombre: socio.nombre });
}
