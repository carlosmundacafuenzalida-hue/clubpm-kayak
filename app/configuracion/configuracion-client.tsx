'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CuotaConfig } from '@/lib/supabase';
import { formatCLP, formatMes, mesActual } from '@/lib/movimientos';

const MONTO_MAX = 200000;

/** Devuelve los próximos N meses (incluyendo el actual) como 'YYYY-MM-01'. */
function proximosMeses(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    d.setMonth(d.getMonth() + 1);
  }
  return out;
}

/** Suma 1 mes a 'YYYY-MM-01'. */
function siguienteMes(mes: string): string {
  const d = new Date(mes + 'T12:00:00');
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function ConfiguracionClient({ cuotas }: { cuotas: CuotaConfig[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [prefill, setPrefill] = useState<{ mes?: string; monto?: number } | null>(null);

  const ultimoMonto = cuotas[0]?.monto;

  function abrirNuevo() {
    setPrefill(null);
    setShowForm(true);
  }

  function duplicarA(mes: string, monto: number) {
    setPrefill({ mes, monto });
    setShowForm(true);
  }

  return (
    <main className="max-w-[1320px] mx-auto px-8 py-10 pb-20">
      <header className="flex items-end justify-between mb-9 gap-5 flex-wrap">
        <div>
          <p className="font-mono text-[11px] text-verde uppercase tracking-[0.16em] mb-2">
            {cuotas.length} {cuotas.length === 1 ? 'mes configurado' : 'meses configurados'}
          </p>
          <h1 className="font-display text-[44px] font-medium text-bosque -tracking-[0.03em] leading-none">
            Cuotas <em className="italic text-verde">mensuales</em>
          </h1>
          <p className="text-ink-soft mt-2 text-sm">
            Define el monto de la cuota para cada mes. Aplica a todos los socios activos.
          </p>
        </div>
        <button onClick={abrirNuevo} className="btn btn-accent">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Configurar próximo mes
        </button>
      </header>

      <div className="panel">
        <div className="grid grid-cols-[1.5fr_1.5fr_1fr] gap-4 px-7 py-3.5 bg-paper-warm border-b border-line text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          <div>Mes</div>
          <div className="text-right">Monto</div>
          <div className="text-right">Acciones</div>
        </div>
        {cuotas.length === 0 ? (
          <p className="px-7 py-16 text-center text-muted text-sm">
            No hay cuotas configuradas aún.
          </p>
        ) : (
          cuotas.map((c) => {
            const proximo = siguienteMes(c.mes);
            const proximoYaExiste = cuotas.some((x) => x.mes === proximo);
            return (
              <div
                key={c.id}
                className="grid grid-cols-[1.5fr_1.5fr_1fr] gap-4 px-7 py-4 items-center border-b border-line-soft last:border-0 hover:bg-paper-warm transition"
              >
                <div className="font-medium text-bosque text-sm capitalize">
                  {formatMes(c.mes)}
                </div>
                <div className="font-mono font-semibold text-right text-sm text-bosque">
                  {formatCLP(Number(c.monto))}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => duplicarA(proximo, Number(c.monto))}
                    disabled={proximoYaExiste}
                    className="btn btn-ghost text-[12px] py-1.5 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={proximoYaExiste ? `${formatMes(proximo)} ya está configurado` : `Duplicar a ${formatMes(proximo)}`}
                  >
                    Duplicar a próximo mes
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showForm && (
        <NuevaCuotaModal
          cuotas={cuotas}
          prefill={prefill}
          sugerencia={ultimoMonto}
          onClose={() => {
            setShowForm(false);
            setPrefill(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setPrefill(null);
            router.refresh();
          }}
        />
      )}
    </main>
  );
}

function NuevaCuotaModal({
  cuotas,
  prefill,
  sugerencia,
  onClose,
  onSaved,
}: {
  cuotas: CuotaConfig[];
  prefill: { mes?: string; monto?: number } | null;
  sugerencia: number | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const mesesConfigurados = new Set(cuotas.map((c) => c.mes));
  const mesesDisponibles = proximosMeses(6).filter((m) => !mesesConfigurados.has(m));

  const mesInicial =
    prefill?.mes && !mesesConfigurados.has(prefill.mes)
      ? prefill.mes
      : mesesDisponibles[0] ?? mesActual();

  const montoInicial =
    prefill?.monto !== undefined
      ? String(prefill.monto)
      : sugerencia !== undefined
      ? String(sugerencia)
      : '';

  const [mes, setMes] = useState(mesInicial);
  const [monto, setMonto] = useState<string>(montoInicial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si el mes viene fija desde "duplicar", lo bloqueamos en el selector.
  const mesFijo = !!(prefill?.mes && !mesesConfigurados.has(prefill.mes));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!mes) {
      setError('Selecciona un mes');
      return;
    }
    const m = Number(monto);
    if (!Number.isFinite(m) || !Number.isInteger(m) || m <= 0) {
      setError('El monto debe ser un entero positivo');
      return;
    }
    if (m > MONTO_MAX) {
      setError(`El monto no puede exceder ${formatCLP(MONTO_MAX)}`);
      return;
    }

    setLoading(true);
    const res = await fetch('/api/cuotas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes, monto: m }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? 'Error al guardar');
      setLoading(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-bosque/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-lg border border-line p-7 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-2xl font-medium text-bosque mb-5">
          Configurar <em className="italic text-verde">cuota</em>
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Mes
            </label>
            {mesFijo ? (
              <div className="w-full px-4 py-3 border-[1.5px] border-line rounded-md bg-paper-warm text-sm font-medium text-bosque capitalize">
                {formatMes(mes)}
              </div>
            ) : mesesDisponibles.length === 0 ? (
              <div className="w-full px-4 py-3 border-[1.5px] border-line rounded-md bg-paper-warm text-sm text-muted">
                No hay meses sin configurar en los próximos 6 meses.
              </div>
            ) : (
              <select
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="w-full px-4 py-3 border-[1.5px] border-line rounded-md outline-none focus:border-verde focus:ring-4 focus:ring-verde/10 bg-white text-sm capitalize"
              >
                {mesesDisponibles.map((m) => (
                  <option key={m} value={m}>{formatMes(m)}</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Monto (CLP)
            </label>
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="30000"
              min={1}
              max={MONTO_MAX}
              step={1}
              className="w-full px-4 py-3 border-[1.5px] border-line rounded-md outline-none focus:border-verde focus:ring-4 focus:ring-verde/10 font-mono text-sm"
            />
            {sugerencia !== undefined && !prefill?.monto && (
              <p className="text-[12px] text-muted mt-1.5">
                Sugerencia: {formatCLP(sugerencia)} (último mes configurado)
              </p>
            )}
          </div>

          {error && (
            <div className="text-rojo text-sm bg-rojo-soft border border-rojo/20 rounded-md px-3 py-2">{error}</div>
          )}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1" disabled={loading}>Cancelar</button>
            <button
              type="submit"
              className="btn btn-primary flex-1"
              disabled={loading || (!mesFijo && mesesDisponibles.length === 0)}
            >
              {loading ? 'Guardando...' : 'Guardar cuota'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
