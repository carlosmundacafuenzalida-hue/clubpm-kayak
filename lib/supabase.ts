import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Tipos del schema. Reflejan exactamente las tablas creadas en Supabase.
 */
export type Socio = {
  id: string;
  rut: string;
  nombre: string;
  telefono: string | null;
  fecha_ingreso: string;
  activo: boolean;
  es_admin: boolean;
  pin_hash: string | null;
};

export type CuotaConfig = {
  id: string;
  mes: string; // 'YYYY-MM-01'
  monto: number;
};

export type TipoMovimiento = 'pago_cuota' | 'pago_extra' | 'cargo' | 'ajuste';

export type Movimiento = {
  id: string;
  tipo: TipoMovimiento;
  fecha_registro: string;
  socio_id: string;
  mes_cuota: string | null;
  monto: number;
  glosa: string;
  comprobante_url: string | null;
  creado_en: string;
  creado_por: string;
};

export type AjusteCuota = {
  id: string;
  socio_id: string;
  mes: string;          // 'YYYY-MM-01'
  monto: number;
  glosa: string;
  creado_en: string;
  creado_por: string;
};

/**
 * Cliente de browser - usa la Publishable key (pública).
 * RLS protege los datos según las policies de la base.
 */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Cliente de servidor - lee/escribe cookies para mantener sesión.
 * Usar en Server Components, Server Actions y Route Handlers.
 */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll falla en Server Components, está OK si hay middleware refrescando.
          }
        },
      },
    }
  );
}
