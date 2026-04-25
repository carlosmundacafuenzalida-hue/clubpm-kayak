'use client';
import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatRut, isValidRut } from '@/lib/rut';
import type { EstadoSocio } from '@/lib/movimientos';
import { RutInput } from '@/components/rut-input';

type SocioRow = {
  id: string;
  rut: string;
  nombre: string;
  telefono: string | null;
  fecha_ingreso: string;
  activo: boolean;
  estado: EstadoSocio;
  mesesAdeudados: string[];
  ultimo_pago: string | null;
};

const FILTROS = [
  { key: 'all',    label: 'Todos' },
  { key: 'al_dia', label: 'Al día' },
  { key: 'pendiente', label: 'Pendientes' },
  { key: 'moroso', label: 'Morosos' },
  { key: 'inactivo', label: 'Inactivos' },
] as const;

export function SociosClient({ socios }: { socios: SocioRow[] }) {
  const sp = useSearchParams();
  const initialFilter = (sp.get('filter') as typeof FILTROS[number]['key']) ?? 'all';
  const [filter, setFilter] = useState<string>(initialFilter);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const counts = useMemo(() => ({
    all: socios.length,
    al_dia: socios.filter((s) => s.estado === 'al_dia').length,
    pendiente: socios.filter((s) => s.estado === 'pendiente').length,
    moroso: socios.filter((s) => s.estado === 'moroso').length,
    inactivo: socios.filter((s) => s.estado === 'inactivo').length,
  }), [socios]);

  const visibles = useMemo(() => {
    let out = filter === 'all' ? socios : socios.filter((s) => s.estado === filter);
    const q = search.trim().toLowerCase();
    if (q) {
      out = out.filter((s) =>
        s.nombre.toLowerCase().includes(q) ||
        s.rut.includes(q.replace(/[.-]/g, ''))
      );
    }
    return out;
  }, [socios, filter, search]);

  return (
    <main className="max-w-[1320px] mx-auto px-8 py-10 pb-20">
      <header className="flex items-end justify-between mb-9 gap-5 flex-wrap">
        <div>
          <p className="font-mono text-[11px] text-verde uppercase tracking-[0.16em] mb-2">
            Total · {socios.length} socios
          </p>
          <h1 className="font-display text-[44px] font-medium text-bosque -tracking-[0.03em] leading-none">
            Gestión de <em className="italic text-verde">socios</em>
          </h1>
          <p className="text-ink-soft mt-2 text-sm">
            Administra los miembros del club, su estado y datos de contacto.
          </p>
        </div>
        <div className="flex gap-2.5">
          <a
            href="/api/reportes/socios"
            className="btn btn-ghost"
            title="Descargar listado de socios en Excel"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 2v9M4.5 7.5L8 11l3.5-3.5M2.5 13.5h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Exportar Excel
          </a>
          <button onClick={() => setShowModal(true)} className="btn btn-accent">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            Nuevo socio
          </button>
        </div>
      </header>

      <div className="flex gap-3 mb-6 flex-wrap items-center">
        <div className="flex-1 min-w-[240px] relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o RUT..."
            className="w-full pl-10 pr-4 py-3 border-[1.5px] border-line rounded-md bg-white outline-none focus:border-verde focus:ring-4 focus:ring-verde/10 transition text-sm"
          />
        </div>
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2.5 rounded-full text-[13px] border-[1.5px] transition ${
              filter === f.key
                ? 'bg-bosque text-white border-bosque'
                : 'bg-white text-ink-soft border-line hover:border-bosque'
            }`}
          >
            {f.label} · {counts[f.key as keyof typeof counts]}
          </button>
        ))}
      </div>

      <div className="panel">
        <div className="grid grid-cols-[2.4fr_1.4fr_1.6fr_1.4fr_1.4fr_auto] gap-4 px-7 py-3.5 bg-paper-warm border-b border-line text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
          <div>Socio</div>
          <div className="hidden md:block">RUT</div>
          <div className="hidden md:block">Teléfono</div>
          <div>Estado</div>
          <div className="hidden md:block">Último pago</div>
          <div></div>
        </div>
        {visibles.length === 0 ? (
          <div className="px-7 py-12 text-center">
            <p className="text-muted text-sm">No hay socios que coincidan con la búsqueda.</p>
          </div>
        ) : (
          visibles.map((s) => <SocioRowEl key={s.id} socio={s}/>)
        )}
      </div>

      {showModal && (
        <NuevoSocioModal onClose={() => setShowModal(false)}/>
      )}
    </main>
  );
}

function SocioRowEl({ socio }: { socio: SocioRow }) {
  const initials = socio.nombre.split(' ').slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const badge = socio.estado === 'al_dia' ? <span className="badge badge-ok">Al día</span>
    : socio.estado === 'moroso' ? <span className="badge badge-warn">Moroso · {socio.mesesAdeudados.length}m</span>
    : socio.estado === 'pendiente' ? <span className="badge badge-pending">Pendiente</span>
    : socio.estado === 'inactivo' ? <span className="badge badge-mute">Inactivo</span>
    : <span className="badge badge-info">Becado</span>;

  return (
    <div className="grid grid-cols-[2.4fr_1.4fr_1.6fr_1.4fr_1.4fr_auto] gap-4 px-7 py-4 items-center border-b border-line-soft last:border-0 hover:bg-paper-warm transition">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-display font-semibold text-[13px] flex-shrink-0 ${
          socio.estado === 'moroso' ? 'bg-rojo-soft text-rojo' :
          socio.estado === 'inactivo' ? 'bg-roca-soft text-roca' :
          'bg-verde-tint text-verde'
        }`}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="font-medium text-bosque text-sm truncate">{socio.nombre}</div>
          <div className="text-[11px] text-muted">
            Activo desde {new Date(socio.fecha_ingreso).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' })}
          </div>
        </div>
      </div>
      <div className="font-mono text-[13px] text-ink-soft hidden md:block">{formatRut(socio.rut)}</div>
      <div className="font-mono text-[13px] text-ink-soft hidden md:block">
        {socio.telefono ? `+${socio.telefono.slice(0, 2)} ${socio.telefono.slice(2, 3)} ${socio.telefono.slice(3, 7)} ${socio.telefono.slice(7)}` : '—'}
      </div>
      <div>{badge}</div>
      <div className="font-mono text-[13px] text-ink-soft hidden md:block">
        {socio.ultimo_pago ? new Date(socio.ultimo_pago).toLocaleDateString('es-CL') : '—'}
      </div>
      <Link
        href={`/socios/${socio.id}`}
        className="w-8 h-8 rounded-lg bg-paper-warm border border-line flex items-center justify-center text-ink-soft hover:bg-verde hover:text-white hover:border-verde transition"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 3l5 5-5 5M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </Link>
    </div>
  );
}

function NuevoSocioModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [rut, setRut] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidRut(rut)) { setError('RUT inválido'); return; }
    if (!nombre.trim()) { setError('Falta nombre'); return; }
    setLoading(true);
    const res = await fetch('/api/socios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut, nombre, telefono }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? 'Error al crear');
      setLoading(false);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-bosque/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-lg border border-line p-7">
        <h2 className="font-display text-2xl font-medium text-bosque mb-5">
          Agregar <em className="italic text-verde">nuevo socio</em>
        </h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Nombre completo
            </label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Pedro Soto"
              className="w-full px-4 py-3 border-[1.5px] border-line rounded-md outline-none focus:border-verde focus:ring-4 focus:ring-verde/10 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              RUT
            </label>
            <RutInput value={rut} onChange={setRut} />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
              Teléfono <span className="text-muted/70 font-normal normal-case">(opcional, formato 569XXXXXXXX)</span>
            </label>
            <input
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="56987654321"
              className="w-full px-4 py-3 border-[1.5px] border-line rounded-md outline-none focus:border-verde focus:ring-4 focus:ring-verde/10 font-mono text-sm"
            />
          </div>
          {error && (
            <div className="text-rojo text-sm bg-rojo-soft border border-rojo/20 rounded-md px-3 py-2">{error}</div>
          )}
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1" disabled={loading}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar socio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
