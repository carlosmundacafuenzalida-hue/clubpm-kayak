'use client';
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isValidRut, normalizeRut, formatRut } from '@/lib/rut';
import { formatMes, formatCLP } from '@/lib/movimientos';

type Tab = 'socios' | 'pagos';

export function ImportarClient() {
  const [tab, setTab] = useState<Tab>('socios');

  return (
    <main className="max-w-[1100px] mx-auto px-8 py-10 pb-20">
      <header className="mb-8">
        <p className="font-mono text-[11px] text-verde uppercase tracking-[0.16em] mb-2">
          Carga masiva
        </p>
        <h1 className="font-display text-[44px] font-medium text-bosque -tracking-[0.03em] leading-none">
          Importar desde <em className="italic text-verde">Excel</em>
        </h1>
        <p className="text-ink-soft mt-2 text-sm">
          Sube planillas de socios o pagos históricos. Los datos se previsualizan antes de escribir en la base.
        </p>
      </header>

      <div className="flex gap-1 mb-6 border-b border-line">
        {(['socios', 'pagos'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition -mb-px ${
              tab === t
                ? 'text-bosque border-bosque'
                : 'text-muted border-transparent hover:text-ink-soft'
            }`}
          >
            {t === 'socios' ? 'Socios' : 'Pagos'}
          </button>
        ))}
      </div>

      {tab === 'socios' ? <ImportarSocios /> : <ImportarPagos />}
    </main>
  );
}

// ─── Socios ──────────────────────────────────

type FilaSocio = {
  nombre: string;
  rut: string;
  rutNormalizado: string | null;
  telefono: string | null;
  fechaIngreso: string | null;
  estado: 'valido' | 'duplicado_archivo' | 'invalido';
  motivo?: string;
};

function ImportarSocios() {
  const router = useRouter();
  const [filas, setFilas] = useState<FilaSocio[] | null>(null);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [parseando, setParseando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ creados: number; duplicados: number; invalidos: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResultado(null);
    setFilas(null);
    setArchivoNombre(file.name);
    setParseando(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const sheet = wb.worksheets[0];
      if (!sheet) throw new Error('La planilla no tiene hojas');

      const headerRow = sheet.getRow(1);
      const headers: Record<string, number> = {};
      headerRow.eachCell((cell, col) => {
        const key = String(cell.value ?? '').trim().toLowerCase();
        if (key) headers[key] = col;
      });

      const colNombre = headers['nombre'];
      const colRut = headers['rut'];
      const colTelefono = headers['teléfono'] ?? headers['telefono'];
      const colFecha = headers['fecha ingreso'] ?? headers['fecha_ingreso'];

      if (!colNombre || !colRut) {
        throw new Error('La planilla debe tener al menos las columnas "Nombre" y "RUT" en la primera fila');
      }

      const out: FilaSocio[] = [];
      const vistos = new Set<string>();

      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const nombre = String(row.getCell(colNombre).value ?? '').trim();
        const rutCell = row.getCell(colRut).value;
        const rut = String(rutCell ?? '').trim();

        if (!nombre && !rut) continue; // fila vacía

        let estado: FilaSocio['estado'] = 'valido';
        let motivo: string | undefined;
        let rutNorm: string | null = null;

        if (!nombre) {
          estado = 'invalido';
          motivo = 'Falta nombre';
        } else if (!rut) {
          estado = 'invalido';
          motivo = 'Falta RUT';
        } else if (!isValidRut(rut)) {
          estado = 'invalido';
          motivo = 'RUT inválido';
        } else {
          rutNorm = normalizeRut(rut);
          if (vistos.has(rutNorm)) {
            estado = 'duplicado_archivo';
            motivo = 'Repetido en este archivo';
          } else {
            vistos.add(rutNorm);
          }
        }

        const tel = colTelefono ? String(row.getCell(colTelefono).value ?? '').replace(/\D/g, '') : '';
        let fecha: string | null = null;
        if (colFecha) {
          const v = row.getCell(colFecha).value;
          if (v instanceof Date) fecha = v.toISOString().slice(0, 10);
          else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) fecha = v.slice(0, 10);
        }

        out.push({
          nombre,
          rut,
          rutNormalizado: rutNorm,
          telefono: tel || null,
          fechaIngreso: fecha,
          estado,
          motivo,
        });
      }

      if (out.length === 0) throw new Error('No se encontraron filas con datos');
      setFilas(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error leyendo el archivo');
    } finally {
      setParseando(false);
    }
  }, []);

  const validas = filas?.filter((f) => f.estado === 'valido') ?? [];

  async function importar() {
    if (validas.length === 0) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch('/api/importar/socios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          socios: validas.map((v) => ({
            rut: v.rutNormalizado,
            nombre: v.nombre,
            telefono: v.telefono,
            fecha_ingreso: v.fechaIngreso,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al importar');
      setResultado(json);
      setFilas(null);
      setArchivoNombre(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <FormatoSocios />

      {!filas && (
        <DropZone
          onFile={handleFile}
          parseando={parseando}
          archivoNombre={archivoNombre}
          accept=".xlsx"
          ayuda="Arrastra un .xlsx con columnas Nombre y RUT, o haz click para elegir."
        />
      )}

      {error && (
        <div className="text-rojo text-sm bg-rojo-soft border border-rojo/20 rounded-md px-4 py-3">
          {error}
        </div>
      )}

      {resultado && (
        <div className="panel px-7 py-5 bg-verde-tint border-verde/30">
          <p className="text-verde font-medium text-sm">
            ✓ Importación completada: {resultado.creados} creados · {resultado.duplicados} ya existían · {resultado.invalidos} inválidos
          </p>
        </div>
      )}

      {filas && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-ink-soft">
              <strong className="text-bosque">{archivoNombre}</strong> · {filas.length} filas leídas
              <span className="ml-3 text-muted">
                ({validas.length} válidas, {filas.filter((f) => f.estado === 'invalido').length} inválidas, {filas.filter((f) => f.estado === 'duplicado_archivo').length} repetidas)
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setFilas(null); setArchivoNombre(null); }}
                className="btn btn-ghost"
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                onClick={importar}
                disabled={enviando || validas.length === 0}
                className="btn btn-primary"
              >
                {enviando ? 'Importando...' : `Importar ${validas.length} socios válidos`}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="grid grid-cols-[60px_1fr_180px_180px] gap-3 px-5 py-3 bg-paper-warm border-b border-line text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              <div>#</div>
              <div>Nombre</div>
              <div>RUT</div>
              <div>Estado</div>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {filas.map((f, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[60px_1fr_180px_180px] gap-3 px-5 py-2.5 border-b border-line-soft last:border-0 items-center text-sm"
                >
                  <div className="font-mono text-muted text-xs">{i + 1}</div>
                  <div className="text-bosque">{f.nombre || <span className="text-muted italic">(vacío)</span>}</div>
                  <div className="font-mono text-ink-soft text-xs">
                    {f.rutNormalizado ? formatRut(f.rutNormalizado) : f.rut || '—'}
                  </div>
                  <div>
                    {f.estado === 'valido' && <span className="badge badge-ok">Válido</span>}
                    {f.estado === 'duplicado_archivo' && <span className="badge badge-pending">{f.motivo}</span>}
                    {f.estado === 'invalido' && <span className="badge badge-warn">{f.motivo}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormatoSocios() {
  return (
    <div className="panel px-6 py-5">
      <h3 className="font-display text-base font-medium text-bosque mb-2">
        Formato esperado
      </h3>
      <div className="text-sm text-ink-soft space-y-1.5">
        <p><span className="font-mono text-xs bg-paper-warm px-2 py-0.5 rounded text-bosque">Nombre</span> · <span className="font-mono text-xs bg-paper-warm px-2 py-0.5 rounded text-bosque">RUT</span> <span className="text-muted">(obligatorias)</span></p>
        <p><span className="font-mono text-xs bg-paper-warm px-2 py-0.5 rounded text-ink-soft">Teléfono</span> · <span className="font-mono text-xs bg-paper-warm px-2 py-0.5 rounded text-ink-soft">Fecha ingreso</span> <span className="text-muted">(opcionales · fecha en formato YYYY-MM-DD)</span></p>
      </div>
    </div>
  );
}

// ─── Pagos ──────────────────────────────────

type FilaPago = {
  rut: string;
  rutNormalizado: string | null;
  rutValido: boolean;
  pagosCelda: { mes: string; monto: number }[];
};

function ImportarPagos() {
  const router = useRouter();
  const [filas, setFilas] = useState<FilaPago[] | null>(null);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [parseando, setParseando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ creados: number; sin_socio: number; errores: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sinSocioRuts, setSinSocioRuts] = useState<string[]>([]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setResultado(null);
    setFilas(null);
    setSinSocioRuts([]);
    setArchivoNombre(file.name);
    setParseando(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(await file.arrayBuffer());
      const sheet = wb.worksheets[0];
      if (!sheet) throw new Error('La planilla no tiene hojas');

      const headerRow = sheet.getRow(1);
      const colMeses: { col: number; mes: string }[] = [];
      let colRut = 0;

      headerRow.eachCell((cell, col) => {
        const raw = cell.value;
        const text = String(raw ?? '').trim().toLowerCase();
        if (text === 'rut') {
          colRut = col;
          return;
        }
        const mes = parseMes(raw);
        if (mes) colMeses.push({ col, mes });
      });

      if (!colRut) throw new Error('Falta una columna llamada "RUT" en la primera fila');
      if (colMeses.length === 0) throw new Error('No se detectó ninguna columna de mes (formatos válidos: 2026-04-01, "abr 2026", o fecha Excel)');

      const out: FilaPago[] = [];
      for (let r = 2; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r);
        const rut = String(row.getCell(colRut).value ?? '').trim();
        if (!rut) continue;

        const valido = isValidRut(rut);
        const rutNorm = valido ? normalizeRut(rut) : null;
        const pagos: { mes: string; monto: number }[] = [];
        for (const { col, mes } of colMeses) {
          const v = row.getCell(col).value;
          const monto = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[^\d.-]/g, ''));
          if (Number.isFinite(monto) && monto > 0) {
            pagos.push({ mes, monto });
          }
        }
        out.push({ rut, rutNormalizado: rutNorm, rutValido: valido, pagosCelda: pagos });
      }

      if (out.length === 0) throw new Error('No se encontraron filas con datos');
      setFilas(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error leyendo el archivo');
    } finally {
      setParseando(false);
    }
  }, []);

  const totalPagos = filas?.reduce((s, f) => s + (f.rutValido ? f.pagosCelda.length : 0), 0) ?? 0;
  const totalMonto = filas?.reduce(
    (s, f) => s + (f.rutValido ? f.pagosCelda.reduce((a, p) => a + p.monto, 0) : 0),
    0
  ) ?? 0;
  const filasInvalidas = filas?.filter((f) => !f.rutValido).length ?? 0;

  async function importar() {
    if (totalPagos === 0) return;
    setEnviando(true);
    setError(null);
    try {
      const pagos = (filas ?? [])
        .filter((f) => f.rutValido && f.rutNormalizado)
        .flatMap((f) =>
          f.pagosCelda.map((p) => ({
            rut: f.rutNormalizado!,
            mes: p.mes,
            monto: p.monto,
          }))
        );
      const res = await fetch('/api/importar/pagos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagos }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Error al importar');
      setResultado(json);
      // Si hubo sin_socio, mostrar la lista de RUTs (los que tenían pagos pero no estaban en la BD)
      if (json.sin_socio > 0) {
        const rutsConPagos = new Set(pagos.map((p) => p.rut));
        // El backend nos dice cuántos pagos no encontraron socio; mostramos los rut únicos que enviamos
        // como pista al tesorero (no podemos saber con seguridad cuáles del envío fallaron sin más detalle).
        setSinSocioRuts(Array.from(rutsConPagos));
      }
      setFilas(null);
      setArchivoNombre(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al importar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <FormatoPagos />

      {!filas && (
        <DropZone
          onFile={handleFile}
          parseando={parseando}
          archivoNombre={archivoNombre}
          accept=".xlsx"
          ayuda="Arrastra un .xlsx con una columna RUT y columnas por mes, o haz click para elegir."
        />
      )}

      {error && (
        <div className="text-rojo text-sm bg-rojo-soft border border-rojo/20 rounded-md px-4 py-3">
          {error}
        </div>
      )}

      {resultado && (
        <div className="panel px-7 py-5 bg-verde-tint border-verde/30">
          <p className="text-verde font-medium text-sm">
            ✓ Importación completada: {resultado.creados} pagos creados · {resultado.sin_socio} sin socio en BD · {resultado.errores} con errores
          </p>
          {sinSocioRuts.length > 0 && resultado.sin_socio > 0 && (
            <p className="text-xs text-ink-soft mt-2">
              Si algún RUT no tenía socio registrado, créalo primero desde la pestaña Socios y reimporta los pagos faltantes.
            </p>
          )}
        </div>
      )}

      {filas && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Filas leídas" value={String(filas.length)} />
            <Stat label="Pagos detectados" value={String(totalPagos)} />
            <Stat label="Monto total" value={formatCLP(totalMonto)} />
            <Stat label="RUTs inválidos" value={String(filasInvalidas)} tone={filasInvalidas > 0 ? 'warn' : 'ok'} />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-ink-soft">
              <strong className="text-bosque">{archivoNombre}</strong>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setFilas(null); setArchivoNombre(null); }}
                className="btn btn-ghost"
                disabled={enviando}
              >
                Cancelar
              </button>
              <button
                onClick={importar}
                disabled={enviando || totalPagos === 0}
                className="btn btn-primary"
              >
                {enviando ? 'Importando...' : `Importar ${totalPagos} pagos`}
              </button>
            </div>
          </div>

          <div className="panel">
            <div className="grid grid-cols-[60px_180px_1fr_140px] gap-3 px-5 py-3 bg-paper-warm border-b border-line text-[11px] font-semibold uppercase tracking-[0.1em] text-muted">
              <div>#</div>
              <div>RUT</div>
              <div>Pagos detectados</div>
              <div className="text-right">Subtotal</div>
            </div>
            <div className="max-h-[480px] overflow-y-auto">
              {filas.map((f, i) => {
                const subtotal = f.pagosCelda.reduce((s, p) => s + p.monto, 0);
                return (
                  <div
                    key={i}
                    className="grid grid-cols-[60px_180px_1fr_140px] gap-3 px-5 py-2.5 border-b border-line-soft last:border-0 items-center text-sm"
                  >
                    <div className="font-mono text-muted text-xs">{i + 1}</div>
                    <div className="font-mono text-ink-soft text-xs">
                      {f.rutValido && f.rutNormalizado ? (
                        formatRut(f.rutNormalizado)
                      ) : (
                        <span className="text-rojo">{f.rut} (inválido)</span>
                      )}
                    </div>
                    <div className="text-xs text-ink-soft truncate">
                      {f.pagosCelda.length === 0 ? (
                        <span className="text-muted italic">sin pagos</span>
                      ) : (
                        f.pagosCelda.map((p) => `${formatMes(p.mes)} (${formatCLP(p.monto)})`).join(' · ')
                      )}
                    </div>
                    <div className="font-mono text-bosque text-right text-xs">
                      {f.rutValido ? formatCLP(subtotal) : '—'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormatoPagos() {
  return (
    <div className="panel px-6 py-5">
      <h3 className="font-display text-base font-medium text-bosque mb-2">
        Formato esperado
      </h3>
      <div className="text-sm text-ink-soft space-y-1.5">
        <p>
          Una columna <span className="font-mono text-xs bg-paper-warm px-2 py-0.5 rounded text-bosque">RUT</span> y una columna por cada mes.
        </p>
        <p className="text-xs text-muted">
          Encabezados de mes aceptados: <span className="font-mono">2026-04-01</span>, <span className="font-mono">abr 2026</span>, <span className="font-mono">abril 2026</span>, o una fecha de Excel.
        </p>
        <p className="text-xs text-muted">
          Cada celda con un número {`>`} 0 se interpreta como un pago de cuota de ese socio para ese mes.
        </p>
      </div>
    </div>
  );
}

// ─── Helpers UI ──────────────────────────────────

function DropZone({
  onFile,
  parseando,
  archivoNombre,
  accept,
  ayuda,
}: {
  onFile: (f: File) => void;
  parseando: boolean;
  archivoNombre: string | null;
  accept: string;
  ayuda: string;
}) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={`panel cursor-pointer text-center px-8 py-14 border-2 border-dashed transition ${
        over ? 'border-verde bg-verde-tint' : 'border-line hover:border-bosque'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
      <svg className="mx-auto mb-3 text-verde" width="36" height="36" viewBox="0 0 24 24" fill="none">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {parseando ? (
        <p className="text-sm text-ink-soft">Leyendo {archivoNombre}...</p>
      ) : (
        <>
          <p className="font-medium text-bosque text-sm mb-1">Arrastra un archivo .xlsx aquí</p>
          <p className="text-xs text-muted">{ayuda}</p>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'ok' | 'warn' }) {
  const color =
    tone === 'warn' ? 'text-rojo' :
    tone === 'ok' ? 'text-verde' :
    'text-bosque';
  return (
    <div className="panel px-5 py-4">
      <div className="font-mono text-[10px] text-muted uppercase tracking-[0.12em] mb-1.5">
        {label}
      </div>
      <div className={`font-display text-2xl font-semibold -tracking-[0.02em] ${color}`}>
        {value}
      </div>
    </div>
  );
}

// ─── Parseo de mes ──────────────────────────────────

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function parseMes(value: unknown): string | null {
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`;
  }
  if (value == null) return null;
  const s = String(value).trim().toLowerCase();
  if (!s) return null;

  // YYYY-MM-DD o YYYY-MM
  const iso = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/);
  if (iso) {
    const m = parseInt(iso[2], 10);
    if (m >= 1 && m <= 12) return `${iso[1]}-${String(m).padStart(2, '0')}-01`;
  }

  // "abr 2026" / "abril 2026" / "abr. 2026"
  const txt = s.match(/^([a-záéíóúñ]+)\.?\s+(\d{4})$/);
  if (txt) {
    const nombre = txt[1];
    let idx = MESES_CORTOS.indexOf(nombre.slice(0, 3));
    if (idx < 0) idx = MESES_LARGOS.indexOf(nombre);
    if (idx >= 0) return `${txt[2]}-${String(idx + 1).padStart(2, '0')}-01`;
  }

  return null;
}
