'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCuotasConfig, getMovimientosDeSocio, calcularEstadoMes, calcularEstadoGeneral, generarMesesDesdeInicio } from '@/lib/movimientos'
import type { EstadoGeneral } from '@/lib/movimientos'

interface ResumenDashboard {
  recaudadoMes: number
  esperadoMes: number
  sociosAlDia: number
  totalSocios: number
  morosos: { nombre: string; deuda: number }[]
  ultimosMovimientos: { fecha: string; glosa: string; monto: number; tipo: string }[]
}

export default function DashboardPage() {
  const [resumen, setResumen] = useState<ResumenDashboard | null>(null)

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const mesActual = new Date()
    mesActual.setDate(1)
    const mesKey = mesActual.toISOString().slice(0, 10)

    const [{ data: socios }, cuotas, { data: movimientos }] = await Promise.all([
      supabase.from('socios').select('id, nombre').eq('activo', true),
      getCuotasConfig(),
      supabase.from('movimientos').select('*').order('creado_en', { ascending: false }).limit(10),
    ])

    const montoMap = Object.fromEntries(cuotas.map(c => [c.mes, c.monto]))
    const montoMesActual = montoMap[mesKey] ?? 0
    const meses = generarMesesDesdeInicio()

    let recaudadoMes = 0
    let sociosAlDia = 0
    const morosos: { nombre: string; deuda: number }[] = []

    for (const socio of socios ?? []) {
      const pagos = await getMovimientosDeSocio(socio.id)
      const pagadoEsteMes = pagos.filter(p => p.mes_cuota === mesKey).reduce((s, p) => s + p.monto, 0)
      recaudadoMes += pagadoEsteMes

      let deudaTotal = 0
      const estados = meses.map(mes => {
        const pagado = pagos.filter(p => p.mes_cuota === mes).reduce((s, p) => s + p.monto, 0)
        const esperado = montoMap[mes] ?? 0
        const estado = calcularEstadoMes(pagado, esperado)
        if (estado !== 'al_dia') deudaTotal += Math.max(0, esperado - pagado)
        return estado
      })

      const estadoGeneral: EstadoGeneral = calcularEstadoGeneral(estados)
      if (estadoGeneral === 'al_dia') sociosAlDia++
      else morosos.push({ nombre: socio.nombre, deuda: deudaTotal })
    }

    setResumen({
      recaudadoMes,
      esperadoMes: (socios?.length ?? 0) * montoMesActual,
      sociosAlDia,
      totalSocios: socios?.length ?? 0,
      morosos: morosos.sort((a, b) => b.deuda - a.deuda),
      ultimosMovimientos: (movimientos ?? []).map(m => ({
        fecha: m.fecha_registro,
        glosa: m.glosa,
        monto: m.monto,
        tipo: m.tipo,
      })),
    })
  }

  if (!resumen) return <div className="p-8 text-center">Cargando...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Recaudado este mes</p>
          <p className="text-2xl font-bold">${resumen.recaudadoMes.toLocaleString('es-CL')}</p>
          <p className="text-xs text-gray-400">de ${resumen.esperadoMes.toLocaleString('es-CL')} esperado</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Socios al día</p>
          <p className="text-2xl font-bold">{resumen.sociosAlDia} / {resumen.totalSocios}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-4">
          <p className="text-gray-500 text-sm">Con deuda</p>
          <p className="text-2xl font-bold text-red-600">{resumen.morosos.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-3">Socios con deuda</h2>
        {resumen.morosos.length === 0
          ? <p className="text-gray-500 text-sm">Todos al día 🎉</p>
          : <ul className="divide-y">{resumen.morosos.map(m => (
              <li key={m.nombre} className="flex justify-between py-2 text-sm">
                <span>{m.nombre}</span>
                <span className="text-red-600 font-medium">${m.deuda.toLocaleString('es-CL')}</span>
              </li>
            ))}</ul>
        }
      </div>

      <div className="bg-white rounded-xl shadow p-4">
        <h2 className="font-semibold mb-3">Últimos movimientos</h2>
        {resumen.ultimosMovimientos.length === 0
          ? <p className="text-gray-500 text-sm">Sin movimientos aún</p>
          : <ul className="divide-y">{resumen.ultimosMovimientos.map((m, i) => (
              <li key={i} className="flex justify-between py-2 text-sm">
                <span className="text-gray-400 w-24">{m.fecha}</span>
                <span className="flex-1 mx-3">{m.glosa}</span>
                <span className={m.tipo === 'gasto' ? 'text-red-600' : 'text-green-600'}>
                  {m.tipo === 'gasto' ? '-' : '+'}${m.monto.toLocaleString('es-CL')}
                </span>
              </li>
            ))}</ul>
        }
      </div>
    </div>
  )
}
