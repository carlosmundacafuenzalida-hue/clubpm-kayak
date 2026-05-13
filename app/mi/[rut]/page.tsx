import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createSupabaseServer, type Socio, type Movimiento, type CuotaConfig } from '@/lib/supabase';
import { calcularEstado, formatCLP, formatMes } from '@/lib/movimientos';
import { formatRut, normalizeRut } from '@/lib/rut';
import { MiniHeader } from '@/components/mini-header';

export const metadata: Metadata = {
  title: 'Mi estado de cuenta — Club PM Kayak',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function MiPage({
  params,
}: {
  params: Promise<{ rut: string }>;
}) {
  const { rut: rutRaw } = await params;
  const rut = normalizeRut(decodeURIComponent(rutRaw));
  if (!rut || rut.length < 3) notFound();

  const supabase = await createSupabaseServer();

  const { data: socioData } = await supabase
    .from('socios')
    .select('*')
    .eq('rut', rut)
    .maybeSingle();

  if (!socioData) notFound();

  const socio = socioData as Socio;

  const [movsRes, cuotasRes] = await Promise.all([
    supabase
      .from('movimientos')
      .select('*')
      .eq('socio_id', socio.id)
      .order('fecha_registro', { ascending: false }),
    supabase.from('cuotas_config').select('*'),
  ]);

  const movimientos = (movsRes.data ?? []) as Movimiento[];
  const cuotas = (cuotasRes.data ?? []) as CuotaConfig[];

  const estado = calcularEstado(socio, movimientos, cuotas, []);
  const initials = socio.nombre.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const totalPagado = movimientos
    .filter((m) => m.tipo === 'pago_cuota' || m.tipo === 'pago_extra')
    .reduce((s, m) => s + Number(m.monto), 0);

  const mesesPagados = Array.from(
    new Set(
      movimientos
        .filter((m) => m.tipo === 'pago_cuota' && m.mes_cuota)
        .map((m) => m.mes_cuota as string)
    )
  ).sort().reverse();

  return (
    <div className="min-h-screen bg-paper">
      <MiniHeader />
      <main className="max-w-[900px] mx-auto px-6 py-10 pb-20">
        {/* Header del socio */}
        <header className="bg-white border border-line rounded-2xl p-7 mb-6 flex items-start gap-5 flex-wrap">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center font-display font-semibold text-3xl ${
            estado.estado === 'moroso' ? 'bg-rojo-soft text-rojo' :
            estado.estado === 'inactivo' ? 'bg-roca-soft text-roca' :
            'bg-verde-tint text-verde'
          }`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl sm:text-4xl font-medium text-bosque -tracking-[0.02em] leading-none">
              {socio.nombre}
            </h1>
            <div className="flex gap-3 mt-3 items-center flex-wrap">
              <span className="font-mono text-sm text-ink-soft">{formatRut(socio.rut)}</span>
              <span className="text-muted">·</span>
              <span className="text-sm text-ink-soft">
                Socio desde {new Date(socio.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {estado.estado === 'al_dia' && <span className="badge badge-ok">Al día</span>}
              {estado.estado === 'pendiente' && <span className="badge badge-pending">Pendiente del mes</span>}
              {estado.estado === 'moroso' && <span className="badge badge-warn">Moroso · {estado.mesesAdeudados.length} {estado.mesesAdeudados.length === 1 ? 'mes' : 'meses'}</span>}
              {estado.estado === 'inactivo' && <span className="badge badge-mute">Socio inactivo</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-xs text-muted uppercase tracking-[0.1em] mb-1">Total pagado</div>
            <div className="font-display text-3xl font-semibold text-bosque -tracking-[0.02em]">
              {formatCLP(totalPagado)}
            </div>
            {estado.montoAdeudado > 0 && (
              <div className="text-rojo font-mono text-sm mt-1">
                {formatCLP(estado.montoAdeudado)} adeudado
              </div>
            )}
          </div>
        </header>

        {/* Meses adeudados */}
        {estado.mesesAdeudados.length > 0 && (
          <div className="panel mb-6">
            <div className="px-7 py-5 border-b border-line">
              <h2 className="font-display text-xl font-medium text-bosque">
                Meses <em className="italic text-rojo">pendientes</em>
              </h2>
              <p className="text-xs text-muted mt-1">
                Cuotas que aún no figuran como pagadas en nuestros registros.
              </p>
            </div>
            <div className="px-7 py-5 flex gap-2 flex-wrap">
              {estado.mesesAdeudados.map((mes) => (
                <span key={mes} className="px-3 py-1.5 bg-rojo-soft text-rojo rounded-full font-mono text-xs font-medium">
                  {formatMes(mes)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Meses pagados */}
        {mesesPagados.length > 0 && (
          <div className="panel mb-6">
            <div className="px-7 py-5 border-b border-line">
              <h2 className="font-display text-xl font-medium text-bosque">
                Meses <em className="italic text-verde">pagados</em>
              </h2>
              <p className="text-xs text-muted mt-1">
                {mesesPagados.length} {mesesPagados.length === 1 ? 'cuota mensual registrada' : 'cuotas mensuales registradas'}.
              </p>
            </div>
            <div className="px-7 py-5 flex gap-2 flex-wrap">
              {mesesPagados.map((mes) => (
                <span key={mes} className="px-3 py-1.5 bg-verde-tint text-verde rounded-full font-mono text-xs font-medium">
                  {formatMes(mes)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Historial */}
        <div className="panel">
          <div className="px-7 py-5 border-b border-line">
            <h2 className="font-display text-xl font-medium text-bosque">
              Historial de <em className="italic text-verde">movimientos</em>
            </h2>
            <p className="text-xs text-muted mt-1">{movimientos.length} {movimientos.length === 1 ? 'registro' : 'registros'}</p>
          </div>
          {movimientos.length === 0 ? (
            <p className="px-7 py-12 text-center text-muted text-sm">
              Aún no hay movimientos registrados.
            </p>
          ) : (
            movimientos.map((m) => {
              const isPago = m.tipo === 'pago_cuota' || m.tipo === 'pago_extra';
              return (
                <div key={m.id} className="px-7 py-4 border-b border-line-soft last:border-0 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isPago ? 'bg-verde-tint text-verde' : 'bg-kayak-soft text-kayak-deep'}`}>
                    {isPago ? '+' : '~'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-bosque text-sm">{m.glosa}</div>
                    <div className="font-mono text-[11px] text-muted mt-0.5">
                      {new Date(m.fecha_registro + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {m.mes_cuota && ` · cuota ${formatMes(m.mes_cuota)}`}
                    </div>
                  </div>
                  <div className={`font-mono font-semibold ${isPago ? 'text-verde' : 'text-ink-soft'}`}>
                    {isPago ? '+' : ''}{formatCLP(Number(m.monto))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <p className="text-center text-xs text-muted mt-8">
          ¿Hay un error en estos datos? Contacta al tesorero del club.
        </p>
      </main>
    </div>
  );
}
