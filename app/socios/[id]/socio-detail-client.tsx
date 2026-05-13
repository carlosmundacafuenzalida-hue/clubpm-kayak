'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Socio, Movimiento, CuotaConfig, AjusteCuota } from '@/lib/supabase';
import { calcularEstado, formatCLP, formatMes, ultimosMeses } from '@/lib/movimientos';
import { formatRut } from '@/lib/rut';
import { Navbar } from '@/components/navbar';

type Props = {
  socio: Socio;
  movimientos: Movimiento[];
  cuotas: CuotaConfig[];
  ajustes: AjusteCuota[];
  sessionNombre: string;
};

export function SocioDetailClient({
  socio: socioInicial,
  movimientos,
  cuotas,
  ajustes: ajustesIniciales,
  sessionNombre,
}: Props) {
  const [socio, setSocio] = useState(socioInicial);
  const [ajustes, setAjustes] = useState(ajustesIniciales);
  const [editandoFecha, setEditandoFecha] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState(socio.fecha_ingreso);
  const [guardandoFecha, setGuardandoFecha] = useState(false);

  async function guardarFechaIngreso() {
    if (!confirm('Cambiar la fecha de ingreso afecta el cálculo histórico de morosidad. ¿Continuar?')) return;
    setGuardandoFecha(true);
    try {
      const r = await fetch(`/api/socios/${socio.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fecha_ingreso: nuevaFecha }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error guardando');
      setSocio(j.socio);
      setEditandoFecha(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardandoFecha(false);
    }
  }

  type ModalState = { mes: string; cuotaGlobal: number; existente: AjusteCuota | null } | null;
  const [modalAjuste, setModalAjuste] = useState<ModalState>(null);
  const [montoInput, setMontoInput] = useState('');
  const [glosaInput, setGlosaInput] = useState('');
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);

  function abrirModalAjuste(mes: string) {
    const cuota = cuotas.find((c) => c.mes === mes);
    const existente = ajustes.find((a) => a.mes === mes) ?? null;
    setMontoInput(existente ? String(existente.monto) : String(cuota?.monto ?? 0));
    setGlosaInput(existente?.glosa ?? '');
    setModalAjuste({ mes, cuotaGlobal: cuota?.monto ?? 0, existente });
  }

  async function guardarAjuste() {
    if (!modalAjuste) return;
    if (glosaInput.trim().length === 0) { alert('Glosa obligatoria'); return; }
    const monto = Number(montoInput);
    if (!Number.isFinite(monto) || monto < 0) { alert('Monto inválido'); return; }

    setGuardandoAjuste(true);
    try {
      const r = await fetch('/api/ajustes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socio_id: socio.id, mes: modalAjuste.mes, monto, glosa: glosaInput.trim() }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error guardando');
      setAjustes((prev) => {
        const sin = prev.filter((a) => a.mes !== modalAjuste.mes);
        return [...sin, j.ajuste];
      });
      setModalAjuste(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardandoAjuste(false);
    }
  }

  async function eliminarAjuste() {
    if (!modalAjuste?.existente) return;
    if (!confirm('Eliminar este ajuste y volver al monto global de la cuota?')) return;
    setGuardandoAjuste(true);
    try {
      const r = await fetch(`/api/ajustes?id=${encodeURIComponent(modalAjuste.existente.id)}`, { method: 'DELETE' });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || 'Error eliminando');
      }
      setAjustes((prev) => prev.filter((a) => a.id !== modalAjuste.existente!.id));
      setModalAjuste(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setGuardandoAjuste(false);
    }
  }

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDesde, setBulkDesde] = useState('');
  const [bulkHasta, setBulkHasta] = useState('');
  const [bulkMonto, setBulkMonto] = useState('0');
  const [bulkGlosa, setBulkGlosa] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);

  async function guardarBulk() {
    if (!bulkDesde || !bulkHasta) { alert('Selecciona ambos meses'); return; }
    if (bulkHasta < bulkDesde) { alert('mes_hasta debe ser >= mes_desde'); return; }
    if (bulkGlosa.trim().length === 0) { alert('Glosa obligatoria'); return; }
    const monto = Number(bulkMonto);
    if (!Number.isFinite(monto) || monto < 0) { alert('Monto inválido'); return; }

    setBulkSaving(true);
    try {
      const r = await fetch('/api/ajustes/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socio_id: socio.id,
          mes_desde: bulkDesde,
          mes_hasta: bulkHasta,
          monto,
          glosa: bulkGlosa.trim(),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Error guardando');
      setAjustes((prev) => {
        const fueraDelRango = prev.filter((a) => a.mes < bulkDesde || a.mes > bulkHasta);
        return [...fueraDelRango, ...(j.ajustes as AjusteCuota[])];
      });
      setBulkOpen(false);
      setBulkDesde(''); setBulkHasta(''); setBulkMonto('0'); setBulkGlosa('');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBulkSaving(false);
    }
  }

  const estado = calcularEstado(socio, movimientos, cuotas, ajustes);
  const initials = socio.nombre.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const totalPagado = movimientos
    .filter((m) => m.tipo === 'pago_cuota' || m.tipo === 'pago_extra')
    .reduce((s, m) => s + Number(m.monto), 0);

  return (
    <div className="min-h-screen bg-paper">
      <Navbar nombre={sessionNombre} />
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
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="btn btn-ghost text-xs px-3.5 py-2"
                title="Aplicar ajuste a un rango de meses"
              >
                Ajuste por rango…
              </button>
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
              {!editandoFecha ? (
                <button
                  type="button"
                  onClick={() => { setNuevaFecha(socio.fecha_ingreso); setEditandoFecha(true); }}
                  className="text-sm text-ink-soft hover:text-verde underline-offset-2 hover:underline"
                  title="Editar fecha de ingreso"
                >
                  Ingresó {new Date(socio.fecha_ingreso + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}
                </button>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <input
                    type="date"
                    value={nuevaFecha}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setNuevaFecha(e.target.value)}
                    className="border border-line rounded px-2 py-1 text-sm font-mono"
                    disabled={guardandoFecha}
                  />
                  <button onClick={guardarFechaIngreso} disabled={guardandoFecha} className="btn btn-primary text-xs px-3 py-1">
                    {guardandoFecha ? '…' : 'Guardar'}
                  </button>
                  <button onClick={() => setEditandoFecha(false)} disabled={guardandoFecha} className="btn btn-ghost text-xs px-3 py-1">
                    Cancelar
                  </button>
                </span>
              )}
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
                <button
                  key={mes}
                  type="button"
                  onClick={() => abrirModalAjuste(mes)}
                  className="px-3 py-1.5 bg-rojo-soft text-rojo rounded-full font-mono text-xs font-medium hover:bg-rojo hover:text-white transition"
                  title="Ajustar este mes"
                >
                  {formatMes(mes)}
                </button>
              ))}
            </div>
            <div className="px-7 pb-5 -mt-1">
              <select
                onChange={(e) => { if (e.target.value) { abrirModalAjuste(e.target.value); e.target.value = ''; } }}
                className="border border-line rounded px-2 py-1 text-xs font-mono"
                defaultValue=""
              >
                <option value="" disabled>Ajustar otro mes…</option>
                {ultimosMeses(36).map((m) => (
                  <option key={m} value={m}>{formatMes(m)}</option>
                ))}
              </select>
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

        {modalAjuste && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-[420px] max-w-full">
              <h2 className="font-display text-xl font-medium text-bosque mb-1">
                Ajustar cuota de <em className="italic text-verde">{formatMes(modalAjuste.mes)}</em>
              </h2>
              <p className="text-xs text-muted mb-4">Cuota global del mes: {formatCLP(modalAjuste.cuotaGlobal)}</p>

              <label className="block text-xs font-mono text-ink-soft mb-1">Monto adeudado por este socio</label>
              <input
                type="number"
                min={0}
                step={1}
                value={montoInput}
                onChange={(e) => setMontoInput(e.target.value)}
                className="w-full border border-line rounded px-3 py-2 mb-3 font-mono"
                disabled={guardandoAjuste}
              />
              <p className="text-[11px] text-muted -mt-2 mb-3">Pone 0 para anular la deuda de este mes.</p>

              <label className="block text-xs font-mono text-ink-soft mb-1">Glosa (obligatoria)</label>
              <textarea
                value={glosaInput}
                onChange={(e) => setGlosaInput(e.target.value)}
                rows={3}
                className="w-full border border-line rounded px-3 py-2 mb-4"
                placeholder="Ej: lesión hasta dic 2025; beca media por situación familiar; etc."
                disabled={guardandoAjuste}
              />

              <div className="flex justify-between gap-2">
                {modalAjuste.existente ? (
                  <button onClick={eliminarAjuste} disabled={guardandoAjuste} className="btn btn-ghost text-xs px-3 py-2 text-rojo">
                    Eliminar ajuste
                  </button>
                ) : <span />}
                <div className="flex gap-2">
                  <button onClick={() => setModalAjuste(null)} disabled={guardandoAjuste} className="btn btn-ghost text-xs px-3 py-2">
                    Cancelar
                  </button>
                  <button onClick={guardarAjuste} disabled={guardandoAjuste} className="btn btn-primary text-xs px-3 py-2">
                    {guardandoAjuste ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {bulkOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-6 w-[460px] max-w-full">
              <h2 className="font-display text-xl font-medium text-bosque mb-1">
                Ajuste por rango — <em className="italic text-verde">{socio.nombre}</em>
              </h2>
              <p className="text-xs text-muted mb-4">Crea un ajuste con el mismo monto y glosa para todos los meses del rango. Reemplaza ajustes existentes.</p>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-mono text-ink-soft mb-1">Mes desde</label>
                  <select value={bulkDesde} onChange={(e) => setBulkDesde(e.target.value)} className="w-full border border-line rounded px-2 py-2 text-sm font-mono" disabled={bulkSaving}>
                    <option value="">—</option>
                    {ultimosMeses(48).map((m) => <option key={m} value={m}>{formatMes(m)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-mono text-ink-soft mb-1">Mes hasta</label>
                  <select value={bulkHasta} onChange={(e) => setBulkHasta(e.target.value)} className="w-full border border-line rounded px-2 py-2 text-sm font-mono" disabled={bulkSaving}>
                    <option value="">—</option>
                    {ultimosMeses(48).map((m) => <option key={m} value={m}>{formatMes(m)}</option>)}
                  </select>
                </div>
              </div>

              <label className="block text-xs font-mono text-ink-soft mb-1">Monto por mes</label>
              <input type="number" min={0} value={bulkMonto} onChange={(e) => setBulkMonto(e.target.value)} className="w-full border border-line rounded px-3 py-2 mb-3 font-mono" disabled={bulkSaving} />

              <label className="block text-xs font-mono text-ink-soft mb-1">Glosa</label>
              <textarea value={bulkGlosa} onChange={(e) => setBulkGlosa(e.target.value)} rows={3} className="w-full border border-line rounded px-3 py-2 mb-4" disabled={bulkSaving} />

              <div className="flex justify-end gap-2">
                <button onClick={() => setBulkOpen(false)} disabled={bulkSaving} className="btn btn-ghost text-xs px-3 py-2">Cancelar</button>
                <button onClick={guardarBulk} disabled={bulkSaving} className="btn btn-primary text-xs px-3 py-2">
                  {bulkSaving ? 'Guardando…' : 'Crear ajustes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
