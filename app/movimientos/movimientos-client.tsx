'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Socio, Movimiento, CuotaConfig } from '@/lib/supabase';
import { formatCLP, formatMes, mesActual, ultimosMeses } from '@/lib/movimientos';

export function MovimientosClient({
  socios,
  movimientos,
  cuotas,
}: {
  socios: Socio[];
  movimientos: Movimiento[];
  cuotas: CuotaConfig[];
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const [showForm, setShowForm] = useState(sp.get('action') === 'nuevo');

  return (
    <main className="max-w-[1320px] mx-auto px-8 py-10 pb-20">
      <header className="flex items-end justify-between mb-9 gap-5 flex-wrap">
        <div>
          <p className="font-mono text-[11px] text-verde uppercase tracking-[0.16em] mb-2">
            {movimientos.length} movimientos registrados
          </p>
          <h1 className="font-display text-[44px] font-medium text-bosque -tracking-[0.03em] leading-none">
            Pagos y <em className="italic text-verde">movimientos</em>
          </h1>
          <p className="text-ink-soft mt-2 text-sm">
            Registra pagos de cuotas y consulta el historial completo del club.
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-accent">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Registrar pago
        </button>
      </header>

      <div className="panel">
        <div className="grid grid-cols-[2fr_1.4fr_1.6fr_1fr_1fr] gap-4 px-7 py-3.5 bg-paper-warm border-b border-line text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          <div>Socio</div>
          <div>Tipo</div>
          <div>Glosa</div>
          <div>Fecha</div>
          <div className="text-right">Monto</div>
        </div>
        {movimientos.length === 0 ? (
          <p className="px-7 py-16 text-center text-muted text-sm">
            No hay movimientos registrados aún.
          </p>
        ) : (
          movimientos.map((m) => {
            const socio = socios.find((s) => s.id === m.socio_id);
            const isPago = m.tipo === 'pago_cuota' || m.tipo === 'pago_extra';
            return (
              <div key={m.id} className="grid grid-cols-[2fr_1.4fr_1.6fr_1fr_1fr] gap-4 px-7 py-4 items-center border-b border-line-soft last:border-0 hover:bg-paper-warm transition">
                <div className="font-medium text-bosque text-sm truncate">
                  {socio?.nombre ?? 'Socio eliminado'}
                </div>
                <div>
                  <span className={`badge ${isPago ? 'badge-ok' : 'badge-pending'}`}>
                    {m.tipo === 'pago_cuota' ? `Cuota ${m.mes_cuota ? formatMes(m.mes_cuota) : ''}`
                      : m.tipo === 'pago_extra' ? 'Pago extra'
                      : m.tipo === 'cargo' ? 'Cargo'
                      : 'Ajuste'}
                  </span>
                </div>
                <div className="text-sm text-ink-soft truncate">{m.glosa}</div>
                <div className="font-mono text-[12px] text-muted">
                  {new Date(m.fecha_registro).toLocaleDateString('es-CL')}
                </div>
                <div className={`font-mono font-semibold text-right text-sm ${isPago ? 'text-verde' : 'text-ink-soft'}`}>
                  {isPago ? '+' : ''}{formatCLP(Number(m.monto))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <NuevoMovimientoModal
          socios={socios}
          cuotas={cuotas}
          onClose={() => {
            setShowForm(false);
            router.replace('/movimientos');
          }}
        />
      )}
    </main>
  );
}

function NuevoMovimientoModal({
  socios, cuotas, onClose,
}: {
  socios: Socio[];
  cuotas: CuotaConfig[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [socioId, setSocioId] = useState('');
  const [tipo, setTipo] = useState<'pago_cuota' | 'pago_extra' | 'cargo' | 'ajuste'>('pago_cuota');
  const [mesCuota, setMesCuota] = useState(mesActual());
  const [monto, setMonto] = useState<string>('');
  const [glosa, setGlosa] = useState('');
  const [comprobante, setComprobante] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-rellenar monto cuando cambia el mes (si es pago_cuota)
  useEffect(() => {
    if (tipo === 'pago_cuota') {
      const config = cuotas.find((c) => c.mes === mesCuota);
      if (config) setMonto(String(config.monto));
    }
  }, [mesCuota, tipo, cuotas]);

  const meses = ultimosMeses(12);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!socioId) { setError('Selecciona un socio'); return; }
    const m = Number(monto);
    if (!m || m <= 0) { setError('Monto inválido'); return; }
    setLoading(true);

    let comprobantePath: string | null = null;
    if (comprobante) {
      const fd = new FormData();
      fd.append('file', comprobante);
      const upRes = await fetch('/api/comprobantes/upload', { method: 'POST', body: fd });
      const upJson = await upRes.json().catch(() => ({}));
      if (!upRes.ok) {
        setError(upJson.error ?? 'Error subiendo comprobante');
        setLoading(false);
        return;
      }
      comprobantePath = upJson.path;
    }

    const res = await fetch('/api/movimientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo,
        socio_id: socioId,
        mes_cuota: tipo === 'pago_cuota' ? mesCuota : null,
        monto: m,
        glosa: glosa || (tipo === 'pago_cuota' ? `Pago cuota ${formatMes(mesCuota)}` : tipo),
        comprobante_url: comprobantePath,
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Error');
      setLoading(false);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-bosque/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-lg border border-line p-7 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-2xl font-medium text-bosque mb-5">
          Registrar <em className="italic text-verde">movimiento</em>
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Socio
            </label>
            <select
              value={socioId}
              onChange={(e) => setSocioId(e.target.value)}
              className="w-full px-4 py-3 border-[1.5px] border-line rounded-md outline-none focus:border-verde focus:ring-4 focus:ring-verde/10 bg-white text-sm"
            >
              <option value="">Selecciona un socio...</option>
              {socios.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Tipo
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['pago_cuota', 'pago_extra', 'cargo', 'ajuste'] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setTipo(t)}
                  className={`px-3 py-2.5 rounded-md text-sm border-[1.5px] transition ${
                    tipo === t
                      ? 'bg-bosque text-white border-bosque'
                      : 'bg-white text-ink-soft border-line hover:border-bosque'
                  }`}
                >
                  {t === 'pago_cuota' ? 'Cuota mensual' : t === 'pago_extra' ? 'Pago extra' : t === 'cargo' ? 'Cargo' : 'Ajuste'}
                </button>
              ))}
            </div>
          </div>

          {tipo === 'pago_cuota' && (
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
                Mes de la cuota
              </label>
              <select
                value={mesCuota}
                onChange={(e) => setMesCuota(e.target.value)}
                className="w-full px-4 py-3 border-[1.5px] border-line rounded-md outline-none focus:border-verde focus:ring-4 focus:ring-verde/10 bg-white text-sm"
              >
                {meses.map((m) => (
                  <option key={m} value={m}>{formatMes(m)}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Monto (CLP)
            </label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="30000"
              className="w-full px-4 py-3 border-[1.5px] border-line rounded-md outline-none focus:border-verde focus:ring-4 focus:ring-verde/10 font-mono text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Glosa <span className="text-muted/70 font-normal normal-case">(opcional)</span>
            </label>
            <input
              value={glosa}
              onChange={(e) => setGlosa(e.target.value)}
              placeholder={tipo === 'pago_cuota' ? `Pago cuota ${formatMes(mesCuota)}` : 'Ej: aporte para regata'}
              className="w-full px-4 py-3 border-[1.5px] border-line rounded-md outline-none focus:border-verde focus:ring-4 focus:ring-verde/10 text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Comprobante <span className="text-muted/70 font-normal normal-case">(opcional · JPG, PNG o PDF, máx 5MB)</span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(e) => setComprobante(e.target.files?.[0] ?? null)}
              className="w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-bosque file:text-white file:px-3 file:py-2 file:cursor-pointer file:text-[12px] file:font-semibold hover:file:bg-verde"
            />
            {comprobante && (
              <p className="text-[12px] text-muted mt-1.5 truncate">
                {comprobante.name} · {(comprobante.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>

          {error && (
            <div className="text-rojo text-sm bg-rojo-soft border border-rojo/20 rounded-md px-3 py-2">{error}</div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1" disabled={loading}>Cancelar</button>
            <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
              {loading ? 'Guardando...' : 'Registrar movimiento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
