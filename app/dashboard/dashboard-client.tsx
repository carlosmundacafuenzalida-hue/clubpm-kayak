'use client';
import Link from 'next/link';
import { useState } from 'react';
import { formatCLP, formatMes, type DashboardSummary } from '@/lib/movimientos';
import { formatRut } from '@/lib/rut';

type Actividad = {
  id: string;
  tipo: string;
  monto: number;
  fecha: string;
  socio_nombre: string;
  glosa: string;
};

export function DashboardClient({
  nombre,
  summary,
  actividad,
}: {
  nombre: string;
  summary: DashboardSummary;
  actividad: Actividad[];
}) {
  const primerNombre = nombre.split(' ')[0];
  const mes = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
  const total = summary.sociosActivos + summary.inactivos;
  const pctAlDia = summary.sociosActivos > 0
    ? Math.round((summary.pagaronEsteMes / summary.sociosActivos) * 100)
    : 0;

  const morososConTelefono = summary.morososDetalle.filter((m) => !!m.socio.telefono);
  const morososSinTelefono = summary.morososDetalle.length - morososConTelefono.length;
  const [bulkOpen, setBulkOpen] = useState(false);

  return (
    <main className="max-w-[1320px] mx-auto px-8 py-10 pb-20">
      {/* Header */}
      <header className="flex items-end justify-between mb-9 gap-5 flex-wrap">
        <div>
          <p className="font-mono text-[11px] text-verde uppercase tracking-[0.16em] mb-2">
            {mes}
          </p>
          <h1 className="font-display text-[44px] font-medium text-bosque -tracking-[0.03em] leading-none">
            Buenos días, <em className="italic text-verde">{primerNombre}</em>
          </h1>
          <p className="text-ink-soft mt-2 text-sm">
            Resumen de la situación financiera del club este mes.
          </p>
        </div>
        <div className="flex gap-2.5">
          <a
            href="/api/reportes/recaudacion?meses=12"
            className="btn btn-ghost"
            title="Descargar recaudación de los últimos 12 meses en Excel"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2.5 13.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Exportar recaudación
          </a>
          <Link href="/movimientos?action=nuevo" className="btn btn-accent">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Registrar pago
          </Link>
        </div>
      </header>

      {/* Métricas */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-8">
        <Metric
          icon={<IconSocios/>}
          color="green"
          value={summary.sociosActivos}
          label="Socios activos"
          sub={`de ${total} en total`}
        />
        <Metric
          icon={<IconCheck/>}
          color="blue"
          value={summary.pagaronEsteMes}
          label="Pagaron este mes"
          sub={`${pctAlDia}% de los activos`}
        />
        <Metric
          icon={<IconWarn/>}
          color="red"
          value={summary.morosos}
          label="Socios morosos"
          sub="requieren contacto"
        />
        <Metric
          icon={<IconMoney/>}
          color="yellow"
          value={formatCLP(summary.recaudadoMes)}
          label="Recaudado en abril"
          sub={summary.morososDetalle.length > 0 ? `${formatCLP(summary.morososDetalle.reduce((s, m) => s + m.montoAdeudado, 0))} pendiente` : 'todo cobrado'}
          isMonetary
        />
      </section>

      {/* Grid principal */}
      <section className="grid lg:grid-cols-[1.6fr_1fr] gap-5">
        {/* Morosos */}
        <div className="panel">
          <div className="px-7 pt-6 pb-4 border-b border-line flex justify-between items-center">
            <div>
              <h2 className="font-display text-[22px] font-medium text-bosque -tracking-[0.02em]">
                Socios con cuotas <em className="italic text-verde">pendientes</em>
              </h2>
              <p className="text-xs text-muted mt-1 font-mono">
                Listado priorizado por meses adeudados
              </p>
            </div>
            <div className="flex gap-2">
              {morososConTelefono.length > 0 && (
                <button
                  onClick={() => setBulkOpen(true)}
                  className="btn btn-accent text-xs px-3.5 py-2"
                  title="Enviar recordatorios por WhatsApp a todos los morosos con teléfono"
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path d="M14 8a6 6 0 0 1-9 5l-3 1 1-3a6 6 0 1 1 11-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                  Recordar a todos
                </button>
              )}
              {summary.morososDetalle.length > 4 && (
                <Link href="/socios?filter=moroso" className="btn btn-ghost text-xs px-3.5 py-2">
                  Ver todos
                </Link>
              )}
            </div>
          </div>
          <div>
            {summary.morososDetalle.length === 0 ? (
              <div className="px-7 py-12 text-center">
                <p className="text-verde font-display text-2xl italic mb-2">¡Todos al día!</p>
                <p className="text-muted text-sm">No hay socios con cuotas pendientes este mes.</p>
              </div>
            ) : (
              summary.morososDetalle.slice(0, 6).map((m) => (
                <MorosoRow
                  key={m.socio.id}
                  nombre={m.socio.nombre}
                  rut={m.socio.rut}
                  meses={m.mesesAdeudados}
                  monto={m.montoAdeudado}
                  socioId={m.socio.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Donut + actividad */}
        <div className="panel flex flex-col">
          <div className="px-7 pt-6 pb-2 border-b border-line">
            <h2 className="font-display text-[22px] font-medium text-bosque -tracking-[0.02em]">
              Estado <em className="italic text-verde">actual</em>
            </h2>
          </div>
          <div className="px-7 py-7 flex flex-col items-center">
            <Donut
              alDia={summary.pagaronEsteMes}
              morosos={summary.morosos}
              inactivos={summary.inactivos}
              pctAlDia={pctAlDia}
            />
            <div className="w-full mt-6 space-y-2.5 text-sm">
              <Legend color="#1D6B3A" label="Al día" value={summary.pagaronEsteMes}/>
              <Legend color="#C0392B" label="Morosos" value={summary.morosos}/>
              <Legend color="#F0EAD8" label="Inactivos" value={summary.inactivos}/>
            </div>
          </div>

          <div className="px-7 py-4 border-t border-b border-line">
            <h3 className="font-display text-lg font-medium text-bosque">
              Actividad <em className="italic text-verde">reciente</em>
            </h3>
          </div>
          <div className="flex-1">
            {actividad.length === 0 ? (
              <p className="px-7 py-6 text-sm text-muted">Sin movimientos registrados aún.</p>
            ) : (
              actividad.map((a, i) => (
                <ActivityRow key={a.id} item={a} isLast={i === actividad.length - 1}/>
              ))
            )}
          </div>
        </div>
      </section>

      {bulkOpen && (
        <BulkReminderModal
          morosos={morososConTelefono}
          sinTelefono={morososSinTelefono}
          onClose={() => setBulkOpen(false)}
        />
      )}
    </main>
  );
}

function BulkReminderModal({
  morosos,
  sinTelefono,
  onClose,
}: {
  morosos: DashboardSummary['morososDetalle'];
  sinTelefono: number;
  onClose: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDeuda = morosos.reduce((s, m) => s + m.montoAdeudado, 0);

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/whatsapp/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ socio_ids: morosos.map((m) => m.socio.id) }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'No se pudo armar la lista');
        setEnviando(false);
        return;
      }
      const urls = (json.urls ?? []) as Array<{ url: string }>;
      urls.forEach((u, i) => setTimeout(() => window.open(u.url, '_blank'), i * 500));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado');
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-bosque/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-lg border border-line p-7 max-h-[90vh] overflow-y-auto">
        <h2 className="font-display text-2xl font-medium text-bosque mb-2">
          Confirmar envío de <em className="italic text-verde">recordatorios</em>
        </h2>
        <p className="text-sm text-ink-soft mb-5">
          Se abrirá una pestaña de WhatsApp por cada socio. Tendrás que presionar enviar en cada una.
        </p>

        {sinTelefono > 0 && (
          <div className="mb-4 px-4 py-3 rounded-md bg-kayak-soft text-kayak-deep text-xs">
            {sinTelefono === 1
              ? '1 moroso no tiene teléfono registrado y será omitido.'
              : `${sinTelefono} morosos no tienen teléfono registrado y serán omitidos.`}
          </div>
        )}

        <div className="border border-line rounded-md max-h-[40vh] overflow-y-auto mb-5">
          {morosos.map((m) => (
            <div
              key={m.socio.id}
              className="px-4 py-3 border-b border-line-soft last:border-0 flex justify-between items-center gap-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-bosque truncate">{m.socio.nombre}</div>
                <div className="font-mono text-[11px] text-muted">
                  {m.mesesAdeudados.length} mes{m.mesesAdeudados.length === 1 ? '' : 'es'}
                  {' · '}
                  Último: {formatMes(m.mesesAdeudados[m.mesesAdeudados.length - 1])}
                </div>
              </div>
              <div className="font-mono font-semibold text-rojo text-[13px] flex-shrink-0">
                {formatCLP(m.montoAdeudado)}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mb-5 px-1 text-sm">
          <span className="text-ink-soft">Total adeudado</span>
          <span className="font-mono font-semibold text-bosque">{formatCLP(totalDeuda)}</span>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-md bg-rojo-soft text-rojo text-xs">{error}</div>
        )}

        <div className="flex gap-2.5 justify-end">
          <button onClick={onClose} className="btn btn-ghost" disabled={enviando}>
            Cancelar
          </button>
          <button
            onClick={enviar}
            className="btn btn-accent"
            disabled={enviando || morosos.length === 0}
          >
            {enviando ? 'Abriendo…' : `Enviar ${morosos.length} recordatorio${morosos.length === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────

function Metric({
  icon, color, value, label, sub, isMonetary,
}: {
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'red' | 'yellow';
  value: number | string;
  label: string;
  sub: string;
  isMonetary?: boolean;
}) {
  const styles = {
    green: 'bg-verde-tint text-verde',
    blue: 'bg-rio-soft text-rio',
    red: 'bg-rojo-soft text-rojo',
    yellow: 'bg-kayak-soft text-kayak-deep',
  };
  return (
    <div className="bg-white border border-line rounded-lg p-5 hover:shadow-md hover:-translate-y-0.5 transition">
      <div className="flex justify-between items-center mb-4">
        <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${styles[color]}`}>
          {icon}
        </div>
      </div>
      <div className={`font-display font-semibold leading-none -tracking-[0.03em] text-bosque ${isMonetary ? 'text-[26px]' : 'text-[38px]'}`}>
        {value}
      </div>
      <div className="text-sm text-ink-soft mt-1.5">{label}</div>
      <div className="text-[11px] text-muted mt-2 font-mono">{sub}</div>
    </div>
  );
}

function MorosoRow({
  nombre, rut, meses, monto, socioId,
}: {
  nombre: string;
  rut: string;
  meses: string[];
  monto: number;
  socioId: string;
}) {
  const initials = nombre.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const mesesTexto = meses.length <= 3
    ? meses.map(formatMes).join(', ')
    : `${meses.length} meses (${formatMes(meses[meses.length - 1])} → ${formatMes(meses[0])})`;

  async function enviarWhatsapp() {
    const res = await fetch('/api/whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ socio_id: socioId, meses, monto }),
    });
    const json = await res.json();
    if (json.url) window.open(json.url, '_blank');
    else alert(json.error ?? 'No se pudo armar el mensaje');
  }

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-7 py-3.5 border-b border-line-soft last:border-0 hover:bg-paper-warm transition">
      <div className="w-9 h-9 rounded-full bg-rojo-soft text-rojo flex items-center justify-center font-display font-semibold text-[13px]">
        {initials}
      </div>
      <div className="min-w-0">
        <div className="font-medium text-bosque text-sm">{nombre}</div>
        <div className="font-mono text-[11px] text-muted">
          {formatRut(rut)} · Adeuda {mesesTexto}
        </div>
      </div>
      <div className="font-mono font-semibold text-rojo text-[13px]">
        {formatCLP(monto)}
      </div>
      <button
        onClick={enviarWhatsapp}
        title="Enviar recordatorio por WhatsApp"
        className="w-8 h-8 rounded-lg bg-paper-warm border border-line flex items-center justify-center text-ink-soft hover:bg-verde hover:text-white hover:border-verde transition"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M14 8a6 6 0 0 1-9 5l-3 1 1-3a6 6 0 1 1 11-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      </button>
    </div>
  );
}

function Donut({
  alDia, morosos, inactivos, pctAlDia,
}: {
  alDia: number;
  morosos: number;
  inactivos: number;
  pctAlDia: number;
}) {
  const total = alDia + morosos + inactivos;
  const C = 2 * Math.PI * 70; // perímetro
  const lenAlDia = total > 0 ? (alDia / total) * C : 0;
  const lenMorosos = total > 0 ? (morosos / total) * C : 0;

  return (
    <div className="relative w-[180px] h-[180px]">
      <svg viewBox="0 0 180 180" width="180" height="180">
        <circle cx="90" cy="90" r="70" fill="none" stroke="#F0EAD8" strokeWidth="20"/>
        {alDia > 0 && (
          <circle
            cx="90" cy="90" r="70"
            fill="none" stroke="#1D6B3A" strokeWidth="20"
            strokeDasharray={`${lenAlDia} ${C}`}
            strokeDashoffset="0"
            transform="rotate(-90 90 90)"
            strokeLinecap="round"
          />
        )}
        {morosos > 0 && (
          <circle
            cx="90" cy="90" r="70"
            fill="none" stroke="#C0392B" strokeWidth="20"
            strokeDasharray={`${lenMorosos} ${C}`}
            strokeDashoffset={`-${lenAlDia}`}
            transform="rotate(-90 90 90)"
            strokeLinecap="round"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-[38px] font-semibold text-bosque leading-none -tracking-[0.02em]">
          {pctAlDia}<em className="text-2xl not-italic font-medium">%</em>
        </div>
        <div className="text-[11px] text-muted uppercase tracking-[0.12em] mt-1">Al día</div>
      </div>
    </div>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-2.5">
        <div className="w-3 h-3 rounded-sm" style={{ background: color }}/>
        <span>{label}</span>
      </div>
      <span className="font-mono font-semibold text-bosque">{value}</span>
    </div>
  );
}

function ActivityRow({ item, isLast }: { item: Actividad; isLast: boolean }) {
  const tipoLabel = item.tipo === 'pago_cuota' ? 'pago de cuota'
    : item.tipo === 'pago_extra' ? 'pago extra'
    : item.tipo === 'cargo' ? 'cargo'
    : 'ajuste';
  const dotColor = item.tipo.startsWith('pago') ? 'bg-verde' : 'bg-kayak';
  return (
    <div className="px-7 py-3.5 border-b border-line-soft last:border-0 flex gap-3.5 relative">
      <div className={`w-2 h-2 rounded-full mt-1.5 ${dotColor} flex-shrink-0 relative`}>
        {!isLast && <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-px h-7 bg-line"/>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px]">
          <strong className="text-bosque font-semibold">{item.socio_nombre}</strong>
          {' '}— {tipoLabel} de <strong className="text-bosque font-semibold">{formatCLP(item.monto)}</strong>
        </div>
        <div className="font-mono text-[11px] text-muted mt-0.5">
          {new Date(item.fecha).toLocaleDateString('es-CL')}
        </div>
      </div>
    </div>
  );
}

// ─── Iconos ──────────────────────────────────
function IconSocios() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <circle cx="6" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M2 14a4 4 0 0 1 8 0M11 8l1.5 1.5L15 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <path d="M3 5l5-2 5 2v6l-5 2-5-2V5zM5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  );
}
function IconWarn() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <path d="M8 1l7 13H1L8 1zM8 6v4M8 12v.5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}
function IconMoney() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <path d="M8 1v14M11 4H6.5a2.5 2.5 0 0 0 0 5h3a2.5 2.5 0 0 1 0 5H5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
