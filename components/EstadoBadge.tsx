import type { EstadoGeneral } from '@/lib/movimientos'

const config: Record<EstadoGeneral, { label: string; classes: string }> = {
  al_dia:  { label: '✅ Al día',        classes: 'bg-green-100 text-green-800' },
  parcial: { label: '⚠️ Deuda parcial', classes: 'bg-yellow-100 text-yellow-800' },
  moroso:  { label: '🔴 Moroso',        classes: 'bg-red-100 text-red-800' },
}

export function EstadoBadge({ estado }: { estado: EstadoGeneral }) {
  const { label, classes } = config[estado]
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${classes}`}>
      {label}
    </span>
  )
}
