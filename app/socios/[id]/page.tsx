import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/session';
import { createSupabaseServer, type Socio, type Movimiento, type CuotaConfig } from '@/lib/supabase';
import { calcularEstado, formatCLP, formatMes, mesActual } from '@/lib/movimientos';
import { formatRut } from '@/lib/rut';
import { Navbar } from '@/components/navbar';

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

  const [socioRes, movsRes, cuotasRes] = await Promise.all([
    supabase.from('socios').select('*').eq('id', id).single(),
    supabase.from('movimientos').select('*').eq('socio_id', id).order('fecha_registro', { ascending: false }),
    supabase.from('cuotas_config').select('*'),
  ]);

  if (socioRes.error || !socioRes.data) notFound();

  const socio = socioRes.data as Socio;
  const movimientos = (movsRes.data ?? []) as Movimiento[];
  const cuotas = (cuotasRes.data ?? []) as CuotaConfig[];

  const estado = calcularEstado(socio, movimientos, cuotas);
  const initials = socio.nombre.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const totalPagado = movimientos
    .filter((m) => m.tipo === 'pago_cuota' || m.tipo === 'pago_extra')
    .reduce((s, m) => s + Number(m.monto), 0);

  return (
    <div className="min-h-screen bg-paper">
      <Navbar nombre={session.nombre} />
      <main className="max-w-[1100px] mx-auto px-8 py-10 pb-20">
        <Link href="/socios" className="font-mono text-xs text-verde hover:underline mb-4 inline-block">
          ← Volver a socios
        </Link>

        {/* Header del socio */}
        <header className="bg-white border border-line rounded-2xl p-8 mb-6 flex items-start gap-6 flex-wrap">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center font-display font-semibold text-3xl ${
            estado.estado === 'moroso' ? 'bg-rojo-soft text-rojo' :
            estado.estado === 'inactivo' ? 'bg-roca-soft text-roca' :
            'bg-verde-tint text-verde'
          }`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h1 className="font-display text-4xl font-medium text-bosque -tracking-[0.02em] leading-none">
                {socio.nombre}
              </h1>
              <a
                href={`/api/reportes/socio/${socio.id}`}
                className="btn btn-ghost text-xs px-3.5 py-2"
                title="Descargar historial de este socio en Excel"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2.5 13.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Exportar historial
              </a>
            </div>
            <div className="flex gap-3 mt-3 items-center flex-wrap">
              <span className="font-mono text-sm text-ink-soft">{formatRut(socio.rut)}</span>
              <span className="text-muted">·</span>
              <span className="font-mono text-sm text-ink-soft">
                {socio.telefono ? `+${socio.telefono}` : 'Sin teléfono'}
              </span>
              <span className="text-muted">·</span>
              <span className="text-sm text-ink-soft">
                Ingresó {new Date(socio.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              {estado.estado === 'al_dia' && <span className="badge badge-ok">Al día</span>}
              {estado.estado === 'pendiente' && <span className="badge badge-pending">Pendiente</span>}
              {estado.estado === 'moroso' && <span className="badge badge-warn">Moroso · {estado.mesesAdeudados.length} meses</span>}
              {estado.estado === 'inactivo' && <span className="badge badge-mute">Inactivo</span>}
              {socio.es_admin && <span className="badge badge-info">Tesorero</span>}
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

        {/* Historial */}
        <div className="panel">
          <div className="px-7 py-5 border-b border-line">
            <h2 className="font-display text-xl font-medium text-bosque">
              Historial de <em className="italic text-verde">movimientos</em>
            </h2>
            <p className="text-xs text-muted mt-1">{movimientos.length} registros</p>
          </div>
          {movimientos.length === 0 ? (
            <p className="px-7 py-12 text-center text-muted text-sm">
              Aún no hay movimientos registrados para este socio.
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
                      {' · '}por {m.creado_por}
                    </div>
                  </div>
                  {m.comprobante_url && (
                    <a
                      href={`/api/comprobantes/${encodeURIComponent(m.comprobante_url)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Ver comprobante"
                      className="text-muted hover:text-verde transition flex-shrink-0"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 17.93 8.8l-8.58 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                      </svg>
                    </a>
                  )}
                  <div className={`font-mono font-semibold ${isPago ? 'text-verde' : 'text-ink-soft'}`}>
                    {isPago ? '+' : ''}{formatCLP(Number(m.monto))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
