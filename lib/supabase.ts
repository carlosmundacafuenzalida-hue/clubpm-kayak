import { createClient } from '@supabase/supabase-js'

export type TipoMovimiento = 'pago_cuota' | 'ingreso_extra' | 'gasto'

export interface Socio {
  id: string
  rut: string
  nombre: string
  telefono: string | null
  fecha_ingreso: string
  activo: boolean
  es_admin: boolean
  pin_hash: string | null
}

export interface CuotaConfig {
  id: string
  mes: string   // 'YYYY-MM-DD' (siempre día 1)
  monto: number
}

export interface Movimiento {
  id: string
  tipo: TipoMovimiento
  fecha_registro: string
  socio_id: string | null
  mes_cuota: string | null
  monto: number
  glosa: string
  comprobante_url: string | null
  creado_en: string
  creado_por: string
}

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
