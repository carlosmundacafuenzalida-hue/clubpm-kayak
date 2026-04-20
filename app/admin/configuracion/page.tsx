'use client'
import { useEffect, useState } from 'react'
import { supabase, type CuotaConfig } from '@/lib/supabase'
import { generarMesesDesdeInicio } from '@/lib/movimientos'

export default function ConfiguracionPage() {
  const [cuotas, setCuotas] = useState<CuotaConfig[]>([])
  const [editMes, setEditMes] = useState<string | null>(null)
  const [monto, setMonto] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('cuotas_config').select('*').order('mes')
    setCuotas(data ?? [])
  }

  async function guardar(mes: string) {
    const montoNum = Number(monto)
    if (!montoNum || montoNum <= 0) return
    const existing = cuotas.find(c => c.mes === mes)
    if (existing) {
      await supabase.from('cuotas_config').update({ monto: montoNum }).eq('id', existing.id)
    } else {
      await supabase.from('cuotas_config').insert({ mes, monto: montoNum })
    }
    setEditMes(null)
    setMonto('')
    cargar()
  }

  const meses = generarMesesDesdeInicio()
  const montoMap = Object.fromEntries(cuotas.map(c => [c.mes, c.monto]))

  function formatMes(mes: string) {
    return new Date(mes + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Configuración de cuotas</h1>
      <p className="text-sm text-gray-500">Define el monto esperado por mes. Puedes configurar montos distintos para cada período.</p>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Mes</th>
              <th className="px-4 py-2 text-right">Monto esperado</th>
              <th className="px-4 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {[...meses].reverse().map(mes => (
              <tr key={mes} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2 capitalize">{formatMes(mes)}</td>
                <td className="px-4 py-2 text-right">
                  {editMes === mes ? (
                    <input
                      type="number"
                      value={monto}
                      onChange={e => setMonto(e.target.value)}
                      className="border rounded px-2 py-1 w-32 text-right text-sm"
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') guardar(mes); if (e.key === 'Escape') { setEditMes(null); setMonto('') } }}
                    />
                  ) : (
                    montoMap[mes]
                      ? `$${Number(montoMap[mes]).toLocaleString('es-CL')}`
                      : <span className="text-gray-400 italic">No configurado</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  {editMes === mes ? (
                    <div className="flex gap-2 justify-center">
                      <button onClick={() => guardar(mes)} className="text-green-600 hover:underline">Guardar</button>
                      <button onClick={() => { setEditMes(null); setMonto('') }} className="text-gray-400 hover:underline">Cancelar</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditMes(mes); setMonto(String(montoMap[mes] ?? '')) }}
                      className="text-blue-600 hover:underline">
                      {montoMap[mes] ? 'Editar' : 'Configurar'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
