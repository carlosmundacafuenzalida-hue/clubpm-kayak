import * as XLSX from 'xlsx'
import type { Movimiento } from './supabase'

export function exportarMovimientos(movimientos: Movimiento[], nombreArchivo = 'movimientos') {
  const filas = movimientos.map(m => ({
    Fecha: m.fecha_registro,
    Tipo: m.tipo,
    Glosa: m.glosa,
    Monto: m.tipo === 'gasto' ? -m.monto : m.monto,
    Comprobante: m.comprobante_url ?? '',
    Registrado_por: m.creado_por,
  }))
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos')
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`)
}

export function exportarMorosos(
  morosos: { nombre: string; rut: string; deuda: number; mesesPendientes: string[] }[],
  nombreArchivo = 'morosos'
) {
  const filas = morosos.map(m => ({
    Nombre: m.nombre,
    RUT: m.rut,
    Deuda_Total: m.deuda,
    Meses_Pendientes: m.mesesPendientes.join(', '),
  }))
  const ws = XLSX.utils.json_to_sheet(filas)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Morosos')
  XLSX.writeFile(wb, `${nombreArchivo}.xlsx`)
}
