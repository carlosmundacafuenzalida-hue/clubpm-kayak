import { supabase, type Movimiento, type CuotaConfig } from './supabase'

export type EstadoMes = 'al_dia' | 'parcial' | 'impago'
export type EstadoGeneral = 'al_dia' | 'parcial' | 'moroso'

export const INICIO_CUOTAS = '2024-08-01'

export function calcularEstadoMes(pagado: number, esperado: number): EstadoMes {
  if (pagado >= esperado) return 'al_dia'
  if (pagado > 0) return 'parcial'
  return 'impago'
}

export function calcularEstadoGeneral(estados: EstadoMes[]): EstadoGeneral {
  if (estados.every(e => e === 'al_dia')) return 'al_dia'
  if (estados.some(e => e === 'impago')) return 'moroso'
  return 'parcial'
}

export function generarMesesDesdeInicio(hasta: Date = new Date()): string[] {
  const meses: string[] = []
  const current = new Date(INICIO_CUOTAS + 'T12:00:00')
  current.setDate(1)
  // Normalise `hasta` to noon local time on the 1st of its month so that
  // date-string inputs like new Date('2024-10-01') (parsed as UTC midnight)
  // are not shifted into the previous month in negative-offset timezones.
  const limite = new Date(
    hasta.getUTCFullYear(),
    hasta.getUTCMonth(),
    1,
    12,
  )
  while (current <= limite) {
    meses.push(current.toISOString().slice(0, 10))
    current.setMonth(current.getMonth() + 1)
  }
  return meses
}

export async function getMovimientosDeSocio(socioId: string): Promise<Movimiento[]> {
  const { data, error } = await supabase
    .from('movimientos')
    .select('*')
    .eq('socio_id', socioId)
    .eq('tipo', 'pago_cuota')
    .order('fecha_registro', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function getCuotasConfig(): Promise<CuotaConfig[]> {
  const { data, error } = await supabase
    .from('cuotas_config')
    .select('*')
    .order('mes')
  if (error) throw error
  return data ?? []
}

export async function insertMovimiento(
  mov: Omit<Movimiento, 'id' | 'creado_en'>
): Promise<void> {
  const { error } = await supabase.from('movimientos').insert(mov)
  if (error) throw error
}

export async function updateMovimiento(
  id: string,
  patch: Partial<Omit<Movimiento, 'id' | 'creado_en'>>
): Promise<void> {
  const { error } = await supabase.from('movimientos').update(patch).eq('id', id)
  if (error) throw error
}
