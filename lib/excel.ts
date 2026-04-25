import ExcelJS from 'exceljs';
import type { Socio, Movimiento, CuotaConfig } from './supabase';
import { calcularEstado, formatMes, mesActual } from './movimientos';
import { formatRut } from './rut';

const COLOR_BOSQUE = 'FF0D3D20';
const COLOR_ZEBRA = 'FFF9FAFB';
const COLOR_WHITE = 'FFFFFFFF';
const FONT_HEADER = { name: 'Calibri', size: 11, bold: true, color: { argb: COLOR_WHITE } } as const;
const FONT_BODY = { name: 'Calibri', size: 11 } as const;

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_BOSQUE } };
    cell.font = FONT_HEADER;
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = {
      bottom: { style: 'thin', color: { argb: COLOR_BOSQUE } },
    };
  });
  row.height = 22;
}

function applyZebraAndBody(sheet: ExcelJS.Worksheet, dataStartRow: number) {
  const lastRow = sheet.rowCount;
  for (let r = dataStartRow; r <= lastRow; r++) {
    const row = sheet.getRow(r);
    const isZebra = (r - dataStartRow) % 2 === 1;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = FONT_BODY;
      cell.alignment = { vertical: 'middle', ...cell.alignment };
      if (isZebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ZEBRA } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_WHITE } };
      }
    });
  }
}

function autoWidth(sheet: ExcelJS.Worksheet, minWidth = 10, maxWidth = 48) {
  sheet.columns.forEach((col) => {
    let max = minWidth;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const v = cell.value;
      let len = 0;
      if (v == null) len = 0;
      else if (typeof v === 'number') len = String(v).length + 4; // espacio para CLP
      else if (v instanceof Date) len = 12;
      else len = String(v).length;
      if (len > max) max = len;
    });
    col.width = Math.min(maxWidth, max + 2);
  });
}

const CLP_FORMAT = '"$"#,##0;[Red]-"$"#,##0';
const DATE_FORMAT = 'dd-mm-yyyy';

function estadoLabel(estado: string): string {
  switch (estado) {
    case 'al_dia': return 'Al día';
    case 'pendiente': return 'Pendiente';
    case 'moroso': return 'Moroso';
    case 'inactivo': return 'Inactivo';
    case 'becado': return 'Becado';
    default: return estado;
  }
}

function tipoLabel(tipo: string): string {
  switch (tipo) {
    case 'pago_cuota': return 'Pago de cuota';
    case 'pago_extra': return 'Pago extra';
    case 'cargo': return 'Cargo';
    case 'ajuste': return 'Ajuste';
    default: return tipo;
  }
}

function parseDateLocal(yyyymmdd: string): Date {
  // Forzar mediodía local para evitar el corrimiento UTC en Chile (UTC-3).
  return new Date(yyyymmdd + 'T12:00:00');
}

export async function generarReporteSocios(
  socios: Socio[],
  movimientos: Movimiento[],
  cuotas: CuotaConfig[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Club PM Kayak';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Socios', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Nombre', key: 'nombre' },
    { header: 'RUT', key: 'rut' },
    { header: 'Teléfono', key: 'telefono' },
    { header: 'Estado', key: 'estado' },
    { header: 'Meses adeudados', key: 'mesesAdeudados' },
    { header: 'Monto adeudado', key: 'montoAdeudado', style: { numFmt: CLP_FORMAT } },
    { header: 'Último pago', key: 'ultimoPago', style: { numFmt: DATE_FORMAT } },
    { header: 'Fecha ingreso', key: 'fechaIngreso', style: { numFmt: DATE_FORMAT } },
  ];

  styleHeaderRow(sheet.getRow(1));

  const ordenados = [...socios].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  for (const s of ordenados) {
    const r = calcularEstado(s, movimientos, cuotas, mesActual());
    const ultimoPago = movimientos
      .filter((m) => m.socio_id === s.id && (m.tipo === 'pago_cuota' || m.tipo === 'pago_extra'))
      .sort((a, b) => b.fecha_registro.localeCompare(a.fecha_registro))[0];

    sheet.addRow({
      nombre: s.nombre,
      rut: formatRut(s.rut),
      telefono: s.telefono ? `+${s.telefono}` : '',
      estado: estadoLabel(r.estado),
      mesesAdeudados: r.mesesAdeudados.length,
      montoAdeudado: r.montoAdeudado,
      ultimoPago: ultimoPago ? parseDateLocal(ultimoPago.fecha_registro) : null,
      fechaIngreso: parseDateLocal(s.fecha_ingreso),
    });
  }

  applyZebraAndBody(sheet, 2);
  autoWidth(sheet);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function generarReporteRecaudacion(
  movimientos: Movimiento[],
  mesesAtras = 12
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Club PM Kayak';
  wb.created = new Date();

  const sheet = wb.addWorksheet('Recaudación', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Mes', key: 'mes' },
    { header: '# pagos', key: 'pagos' },
    { header: 'Monto recaudado', key: 'monto', style: { numFmt: CLP_FORMAT } },
    { header: 'Promedio por pago', key: 'promedio', style: { numFmt: CLP_FORMAT } },
  ];

  styleHeaderRow(sheet.getRow(1));

  // Lista de meses (más reciente primero)
  const meses: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = 0; i < mesesAtras; i++) {
    meses.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-01`);
    cursor.setMonth(cursor.getMonth() - 1);
  }

  for (const mes of meses) {
    const inicio = parseDateLocal(mes);
    const fin = parseDateLocal(mes);
    fin.setMonth(fin.getMonth() + 1);

    const pagosDelMes = movimientos.filter((m) => {
      if (m.tipo !== 'pago_cuota' && m.tipo !== 'pago_extra') return false;
      const fr = parseDateLocal(m.fecha_registro);
      return fr >= inicio && fr < fin;
    });

    const total = pagosDelMes.reduce((s, m) => s + Number(m.monto), 0);
    const promedio = pagosDelMes.length > 0 ? total / pagosDelMes.length : 0;

    sheet.addRow({
      mes: formatMes(mes),
      pagos: pagosDelMes.length,
      monto: total,
      promedio,
    });
  }

  applyZebraAndBody(sheet, 2);
  autoWidth(sheet);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function generarReporteSocio(
  socio: Socio,
  movimientos: Movimiento[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Club PM Kayak';
  wb.created = new Date();

  const sheet = wb.addWorksheet(`Historial ${socio.nombre.slice(0, 24)}`, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  sheet.columns = [
    { header: 'Fecha', key: 'fecha', style: { numFmt: DATE_FORMAT } },
    { header: 'Tipo', key: 'tipo' },
    { header: 'Mes cuota', key: 'mesCuota' },
    { header: 'Monto', key: 'monto', style: { numFmt: CLP_FORMAT } },
    { header: 'Glosa', key: 'glosa' },
    { header: 'Creado por', key: 'creadoPor' },
  ];

  styleHeaderRow(sheet.getRow(1));

  const ordenados = [...movimientos].sort((a, b) =>
    b.fecha_registro.localeCompare(a.fecha_registro)
  );

  for (const m of ordenados) {
    sheet.addRow({
      fecha: parseDateLocal(m.fecha_registro),
      tipo: tipoLabel(m.tipo),
      mesCuota: m.mes_cuota ? formatMes(m.mes_cuota) : '',
      monto: Number(m.monto),
      glosa: m.glosa,
      creadoPor: m.creado_por,
    });
  }

  applyZebraAndBody(sheet, 2);
  autoWidth(sheet);

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
