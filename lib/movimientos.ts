import type { Movimiento, Socio, CuotaConfig } from './supabase';

/** Mes en formato 'YYYY-MM-01' (primer día del mes). */
export function mesActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/** Devuelve los últimos N meses como array de 'YYYY-MM-01' (más reciente primero). */
export function ultimosMeses(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = 0; i < n; i++) {
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

/** Formatea un mes 'YYYY-MM-01' a 'abr 2026'. */
export function formatMes(mes: string): string {
  const [y, m] = mes.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${meses[parseInt(m, 10) - 1]} ${y}`;
}

/** Formatea pesos chilenos. */
export function formatCLP(monto: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(monto);
}

export type EstadoSocio = 'al_dia' | 'pendiente' | 'moroso' | 'inactivo' | 'becado';

/**
 * Calcula el estado de un socio para un mes dado.
 * - Inactivo: socio.activo = false
 * - Moroso: meses adeudados >= 1 (cuenta meses pasados sin pago)
 * - Pendiente: este mes aún no paga, pero está al día con meses anteriores
 * - Al día: pagó este mes
 */
export function calcularEstado(
  socio: Socio,
  movimientos: Movimiento[],
  cuotasConfig: CuotaConfig[],
  mesReferencia: string = mesActual()
): { estado: EstadoSocio; mesesAdeudados: string[]; montoAdeudado: number } {
  if (!socio.activo) {
    return { estado: 'inactivo', mesesAdeudados: [], montoAdeudado: 0 };
  }

  const ingreso = socio.fecha_ingreso.slice(0, 7) + '-01';

  // Lista de meses que el socio debió pagar (desde su ingreso hasta el mes de referencia).
  // Importante: T12:00:00 evita que el timezone tire la fecha al día anterior.
  const mesesEsperados: string[] = [];
  let cursor = new Date(ingreso + 'T12:00:00');
  const fin = new Date(mesReferencia + 'T12:00:00');
  while (cursor <= fin) {
    mesesEsperados.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`
    );
    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Pagos del socio (tipo pago_cuota) agrupados por mes_cuota.
  const mesesPagados = new Set(
    movimientos
      .filter((m) => m.socio_id === socio.id && m.tipo === 'pago_cuota' && m.mes_cuota)
      .map((m) => m.mes_cuota as string)
  );

  // Meses del pasado adeudados (sin contar el mes actual).
  const mesesAdeudados = mesesEsperados
    .filter((m) => m < mesReferencia && !mesesPagados.has(m));

  const montoAdeudado = mesesAdeudados.reduce((sum, mes) => {
    const config = cuotasConfig.find((c) => c.mes === mes);
    return sum + (config?.monto ?? 0);
  }, 0);

  if (mesesAdeudados.length > 0) {
    return { estado: 'moroso', mesesAdeudados, montoAdeudado };
  }

  if (mesesPagados.has(mesReferencia)) {
    return { estado: 'al_dia', mesesAdeudados: [], montoAdeudado: 0 };
  }

  return { estado: 'pendiente', mesesAdeudados: [], montoAdeudado: 0 };
}

/** Resumen del dashboard. */
export type DashboardSummary = {
  sociosActivos: number;
  pagaronEsteMes: number;
  morosos: number;
  inactivos: number;
  recaudadoMes: number;
  morososDetalle: Array<{
    socio: Socio;
    mesesAdeudados: string[];
    montoAdeudado: number;
  }>;
};

export function calcularDashboard(
  socios: Socio[],
  movimientos: Movimiento[],
  cuotasConfig: CuotaConfig[]
): DashboardSummary {
  const mes = mesActual();
  let sociosActivos = 0;
  let pagaronEsteMes = 0;
  let morosos = 0;
  let inactivos = 0;
  let recaudadoMes = 0;
  const morososDetalle: DashboardSummary['morososDetalle'] = [];

  for (const socio of socios) {
    const r = calcularEstado(socio, movimientos, cuotasConfig, mes);
    if (r.estado === 'inactivo') { inactivos++; continue; }
    sociosActivos++;
    if (r.estado === 'al_dia') pagaronEsteMes++;
    if (r.estado === 'moroso') {
      morosos++;
      morososDetalle.push({
        socio,
        mesesAdeudados: r.mesesAdeudados,
        montoAdeudado: r.montoAdeudado,
      });
    }
  }

  // Recaudación del mes = suma de pagos (pago_cuota + pago_extra) registrados en este mes calendario.
  const inicioMes = new Date(mes + 'T12:00:00');
  const finMes = new Date(mes + 'T12:00:00');
  finMes.setMonth(finMes.getMonth() + 1);
  recaudadoMes = movimientos
    .filter((m) => {
      const fr = new Date(m.fecha_registro + 'T12:00:00');
      return (
        (m.tipo === 'pago_cuota' || m.tipo === 'pago_extra') &&
        fr >= inicioMes &&
        fr < finMes
      );
    })
    .reduce((sum, m) => sum + Number(m.monto), 0);

  morososDetalle.sort((a, b) => b.mesesAdeudados.length - a.mesesAdeudados.length);

  return { sociosActivos, pagaronEsteMes, morosos, inactivos, recaudadoMes, morososDetalle };
}
