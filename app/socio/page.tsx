'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession, clearSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import {
  generarMesesDesdeInicio, calcularEstadoMes, calcularEstadoGeneral,
  getCuotasConfig, getMovimientosDeSocio,
  type EstadoMes
} from '@/lib/movimientos'
import { EstadoBadge } from '@/components/EstadoBadge'

interface FilaMes {
  mes: string
  esperado: number
  pagado: number
  estado: EstadoMes
  glosa: string
  comprobante_url: string | null
}

export default function SocioPage() {
  const router = useRouter()
  const [filas, setFilas] = useState<FilaMes[]>([])
  const [nombre, setNombre] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const session = getSession()
    if (!session || session.esAdmin) { router.push('/login'); return }
    setNombre(session.nombre)
    cargarDatos(session.rut)
  }, [router])

  async function cargarDatos(rut: string) {
    const { data: socio } = await supabase
      .from('socios').select('id').eq('rut', rut).single()
    if (!socio) return

    const [cuotas, movimientos] = await Promise.all([
      getCuotasConfig(),
      getMovimientosDeSocio(socio.id),
    ])

    const montoMap = Object.fromEntries(cuotas.map(c => [c.mes, c.monto]))
    const meses = generarMesesDesdeInicio()

    const resultado: FilaMes[] = meses.map(mes => {
      const pagosDelMes = movimientos.filter(m => m.mes_cuota === mes)
      const pagado = pagosDelMes.reduce((s, m) => s + m.monto, 0)
      const esperado = montoMap[mes] ?? 0
      return {
        mes,
        esperado,
        pagado,
        estado: calcularEstadoMes(pagado, esperado),
        glosa: pagosDelMes.map(m => m.glosa).join(', '),
        comprobante_url: pagosDelMes.find(m => m.comprobante_url)?.comprobante_url ?? null,
      }
    })

    setFilas(resultado)
    setLoading(false)
  }

  const estadoGeneral = calcularEstadoGeneral(filas.map(f => f.estado))
  const totalDeuda = filas.reduce((s, f) => s + Math.max(0, f.esperado - f.pagado), 0)

  function formatMes(mes: string) {
    return new Date(mes + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  }

  if (loading) return <div className="p-8 text-center">Cargando...</div>

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">Hola, {nombre}</h1>
        <button onClick={() => { clearSession(); router.push('/login') }}
          className="text-sm text-gray-500 hover:underline">Salir</button>
      </div>

      <div className="bg-white rounded-xl shadow p-6 flex justify-between items-center">
        <EstadoBadge estado={estadoGeneral} />
        {totalDeuda > 0 && (
          <span className="text-red-600 font-bold text-lg">
            Deuda total: ${totalDeuda.toLocaleString('es-CL')}
          </span>
        )}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Mes</th>
              <th className="px-4 py-2 text-right">Esperado</th>
              <th className="px-4 py-2 text-right">Pagado</th>
              <th className="px-4 py-2 text-center">Estado</th>
              <th className="px-4 py-2 text-left">Glosa</th>
              <th className="px-4 py-2 text-center">Comprobante</th>
            </tr>
          </thead>
          <tbody>
            {[...filas].reverse().map(fila => (
              <tr key={fila.mes} className="border-t">
                <td className="px-4 py-2 capitalize">{formatMes(fila.mes)}</td>
                <td className="px-4 py-2 text-right">${fila.esperado.toLocaleString('es-CL')}</td>
                <td className="px-4 py-2 text-right">${fila.pagado.toLocaleString('es-CL')}</td>
                <td className="px-4 py-2 text-center">
                  {fila.estado === 'al_dia' ? '✅' : fila.estado === 'parcial' ? '⚠️' : '🔴'}
                </td>
                <td className="px-4 py-2 text-gray-500">{fila.glosa}</td>
                <td className="px-4 py-2 text-center">
                  {fila.comprobante_url && (
                    <a href={fila.comprobante_url} target="_blank"
                      className="text-blue-600 hover:underline">Ver</a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
