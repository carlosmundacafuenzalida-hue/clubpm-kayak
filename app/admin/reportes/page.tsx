'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { exportarMovimientos, exportarMorosos } from '@/lib/excel'
import { getCuotasConfig, getMovimientosDeSocio, calcularEstadoMes, generarMesesDesdeInicio } from '@/lib/movimientos'

export default function ReportesPage() {
  const [desde, setDesde] = useState('2024-08-01')
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10))
  const [generando, setGenerando] = useState(false)

  async function descargarMovimientos() {
    setGenerando(true)
    const { data } = await supabase
      .from('movimientos').select('*')
      .gte('fecha_registro', desde)
      .lte('fecha_registro', hasta)
      .order('fecha_registro')
    exportarMovimientos(data ?? [], `movimientos_${desde}_${hasta}`)
    setGenerando(false)
  }

  async function descargarMorosos() {
    setGenerando(true)
    const [{ data: socios }, cuotas] = await Promise.all([
      supabase.from('socios').select('id, rut, nombre').eq('activo', true),
      getCuotasConfig(),
    ])
    const montoMap = Object.fromEntries(cuotas.map(c => [c.mes, c.monto]))
    const meses = generarMesesDesdeInicio()
    const morosos: { nombre: string; rut: string; deuda: number; mesesPendientes: string[] }[] = []

    for (const s of socios ?? []) {
      const pagos = await getMovimientosDeSocio(s.id)
      let deuda = 0
      const mesesPendientes: string[] = []
      for (const mes of meses) {
        const pagado = pagos.filter(p => p.mes_cuota === mes).reduce((a, p) => a + p.monto, 0)
        const esperado = montoMap[mes] ?? 0
        if (calcularEstadoMes(pagado, esperado) !== 'al_dia') {
          deuda += Math.max(0, esperado - pagado)
          mesesPendientes.push(new Date(mes + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }))
        }
      }
      if (deuda > 0) morosos.push({ nombre: s.nombre, rut: s.rut, deuda, mesesPendientes })
    }
    exportarMorosos(morosos, `morosos_${new Date().toISOString().slice(0, 10)}`)
    setGenerando(false)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Reportes</h1>
      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div className="flex gap-4 items-end flex-wrap">
          <div>
            <label className="block text-sm font-medium mb-1">Desde</label>
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)}
              className="border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Hasta</label>
            <input type="date" value={hasta} onChange={e => setHasta(e.target.value)}
              className="border rounded px-2 py-1 text-sm" />
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={descargarMovimientos} disabled={generando}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50">
            {generando ? 'Generando...' : 'Descargar movimientos (.xlsx)'}
          </button>
          <button onClick={descargarMorosos} disabled={generando}
            className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 disabled:opacity-50">
            {generando ? 'Generando...' : 'Descargar morosos (.xlsx)'}
          </button>
        </div>
      </div>
    </div>
  )
}
