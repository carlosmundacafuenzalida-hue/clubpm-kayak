import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createSupabaseServer } from '@/lib/supabase';
import { formatCLP, formatMes } from '@/lib/movimientos';

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.es_admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const socioId = body?.socio_id;
  const mesesAdeudados: string[] = body?.meses ?? [];
  const monto: number = Number(body?.monto ?? 0);

  if (!socioId) return NextResponse.json({ error: 'Falta socio_id' }, { status: 400 });

  const supabase = await createSupabaseServer();
  const { data: socio, error } = await supabase
    .from('socios')
    .select('nombre, telefono, rut')
    .eq('id', socioId)
    .single();

  if (error || !socio) {
    return NextResponse.json({ error: 'Socio no encontrado' }, { status: 404 });
  }
  if (!socio.telefono) {
    return NextResponse.json({ error: 'El socio no tiene teléfono registrado' }, { status: 400 });
  }

  const mesesTexto = mesesAdeudados.length > 0
    ? mesesAdeudados.map(formatMes).join(', ')
    : 'el mes en curso';

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || req.nextUrl.origin;
  const estadoUrl = `${baseUrl}/mi/${encodeURIComponent(socio.rut)}`;

  const mensaje = [
    `Hola ${socio.nombre.split(' ')[0]}, te saluda el Club PM Kayak 🛶`,
    '',
    `Te recordamos que tienes pendiente el pago de la(s) cuota(s) de: ${mesesTexto}.`,
    monto > 0 ? `Monto adeudado: ${formatCLP(monto)}` : '',
    '',
    'Cualquier consulta avísame por aquí. ¡Gracias!',
    '',
    `Puedes ver tu estado de cuenta aquí: ${estadoUrl}`,
  ].filter(Boolean).join('\n');

  const url = `https://wa.me/${socio.telefono}?text=${encodeURIComponent(mensaje)}`;
  return NextResponse.json({ url, telefono: socio.telefono });
}
