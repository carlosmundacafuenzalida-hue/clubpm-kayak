import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createSupabaseServer } from '@/lib/supabase';
import { isValidRut, normalizeRut } from '@/lib/rut';

export const dynamic = 'force-dynamic';

type SocioInput = {
  rut: unknown;
  nombre: unknown;
  telefono?: unknown;
  fecha_ingreso?: unknown;
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const entradas: SocioInput[] = Array.isArray(body?.socios) ? body.socios : [];
  if (entradas.length === 0) {
    return NextResponse.json({ error: 'Lista vacía' }, { status: 400 });
  }

  let invalidos = 0;
  const validos: { rut: string; nombre: string; telefono: string | null; fecha_ingreso: string }[] = [];
  const vistos = new Set<string>();

  for (const e of entradas) {
    const rutRaw = String(e.rut ?? '').trim();
    const nombre = String(e.nombre ?? '').trim();
    if (!rutRaw || !nombre || !isValidRut(rutRaw)) {
      invalidos++;
      continue;
    }
    const rut = normalizeRut(rutRaw);
    if (vistos.has(rut)) continue; // duplicado dentro del mismo archivo, lo ignoramos silenciosamente
    vistos.add(rut);

    const telefono = e.telefono ? String(e.telefono).replace(/\D/g, '') : null;
    let fechaIngreso = new Date().toISOString().slice(0, 10);
    if (e.fecha_ingreso) {
      const f = String(e.fecha_ingreso).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(f)) fechaIngreso = f;
    }

    validos.push({
      rut,
      nombre,
      telefono: telefono && telefono.length > 0 ? telefono : null,
      fecha_ingreso: fechaIngreso,
    });
  }

  if (validos.length === 0) {
    return NextResponse.json({ creados: 0, duplicados: 0, invalidos });
  }

  const supabase = await createSupabaseServer();

  // Detecta duplicados consultando los RUTs existentes
  const { data: existentes } = await supabase
    .from('socios')
    .select('rut')
    .in('rut', validos.map((v) => v.rut));
  const rutsExistentes = new Set((existentes ?? []).map((r: { rut: string }) => r.rut));

  const aInsertar = validos
    .filter((v) => !rutsExistentes.has(v.rut))
    .map((v) => ({
      ...v,
      activo: true,
      es_admin: false,
      pin_hash: null,
    }));

  const duplicados = validos.length - aInsertar.length;

  if (aInsertar.length === 0) {
    return NextResponse.json({ creados: 0, duplicados, invalidos });
  }

  const { data, error } = await supabase
    .from('socios')
    .insert(aInsertar)
    .select('id');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ creados: data?.length ?? 0, duplicados, invalidos });
}
