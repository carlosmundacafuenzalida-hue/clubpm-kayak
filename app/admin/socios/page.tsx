'use client'
import { useEffect, useState } from 'react'
import { supabase, type Socio } from '@/lib/supabase'
import { normalizeRut } from '@/lib/rut'
import { getSession } from '@/lib/session'
import { getCuotasConfig, getMovimientosDeSocio, calcularEstadoGeneral, calcularEstadoMes, generarMesesDesdeInicio } from '@/lib/movimientos'
import { EstadoBadge } from '@/components/EstadoBadge'
import { RutInput } from '@/components/RutInput'
import type { EstadoGeneral } from '@/lib/movimientos'

interface SocioConEstado extends Socio {
  deudaTotal: number
  estadoGeneral: EstadoGeneral
  whatsappUrl: string
}

const EMPTY_FORM = { rut: '', nombre: '', telefono: '', fecha_ingreso: '' }

export default function SociosPage() {
  const [socios, setSocios] = useState<SocioConEstado[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editId, setEditId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const session = getSession()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setLoading(true)
    const { data } = await supabase.from('socios').select('*').eq('activo', true).order('nombre')
    const cuotas = await getCuotasConfig()
    const montoMap = Object.fromEntries(cuotas.map(c => [c.mes, c.monto]))
    const meses = generarMesesDesdeInicio()

    const resultado: SocioConEstado[] = []
    for (const s of data ?? []) {
      const pagos = await getMovimientosDeSocio(s.id)
      let deudaTotal = 0
      const estados = meses.map(mes => {
        const pagado = pagos.filter(p => p.mes_cuota === mes).reduce((a, p) => a + p.monto, 0)
        const esperado = montoMap[mes] ?? 0
        const estado = calcularEstadoMes(pagado, esperado)
        if (estado !== 'al_dia') deudaTotal += Math.max(0, esperado - pagado)
        return estado
      })
      const estadoGeneral = calcularEstadoGeneral(estados)
      const mesesMorosos = meses
        .filter((_, i) => estados[i] !== 'al_dia')
        .map(m => new Date(m + 'T12:00:00').toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }))
      const msg = encodeURIComponent(
        `Hola ${s.nombre}, tienes ${mesesMorosos.length} mes(es) pendiente(s) por $${deudaTotal.toLocaleString('es-CL')}. Meses: ${mesesMorosos.join(', ')}.`
      )
      resultado.push({ ...s, deudaTotal, estadoGeneral, whatsappUrl: `https://wa.me/${s.telefono}?text=${msg}` })
    }
    setSocios(resultado)
    setLoading(false)
  }

  async function guardar() {
    setError('')
    const rut = normalizeRut(form.rut)
    if (!rut || !form.nombre || !form.fecha_ingreso) {
      setError('Completa todos los campos obligatorios.')
      return
    }
    if (editId) {
      const { error: e } = await supabase
        .from('socios')
        .update({ nombre: form.nombre, telefono: form.telefono, fecha_ingreso: form.fecha_ingreso })
        .eq('id', editId)
      if (e) { setError(e.message); return }
    } else {
      const { error: e } = await supabase
        .from('socios')
        .insert({ rut, nombre: form.nombre, telefono: form.telefono, fecha_ingreso: form.fecha_ingreso, activo: true, es_admin: false })
      if (e) { setError(e.message); return }
    }
    setForm(EMPTY_FORM)
    setEditId(null)
    cargar()
  }

  async function darDeBaja(id: string) {
    if (!confirm('¿Dar de baja este socio? Quedará inactivo pero se conserva su historial.')) return
    await supabase.from('socios').update({ activo: false }).eq('id', id)
    cargar()
  }

  if (loading) return <div className="p-8 text-center">Cargando...</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Socios</h1>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">{editId ? 'Editar socio' : 'Agregar socio'}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">RUT *</label>
            <RutInput value={form.rut} onChange={v => setForm(f => ({ ...f, rut: v }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-sm mb-1">Nombre *</label>
            <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-sm mb-1">Teléfono (569...)</label>
            <input value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-sm mb-1">Fecha ingreso *</label>
            <input type="date" value={form.fecha_ingreso} onChange={e => setForm(f => ({ ...f, fecha_ingreso: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button onClick={guardar}
            className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700">
            {editId ? 'Guardar cambios' : 'Agregar'}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm(EMPTY_FORM) }}
              className="px-4 py-1 rounded text-sm border hover:bg-gray-50">Cancelar</button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Nombre</th>
              <th className="px-4 py-2 text-left">RUT</th>
              <th className="px-4 py-2 text-center">Estado</th>
              <th className="px-4 py-2 text-right">Deuda</th>
              <th className="px-4 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {socios.map(s => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{s.nombre}</td>
                <td className="px-4 py-2 text-gray-500">{s.rut}</td>
                <td className="px-4 py-2 text-center"><EstadoBadge estado={s.estadoGeneral} /></td>
                <td className="px-4 py-2 text-right">
                  {s.deudaTotal > 0 ? `$${s.deudaTotal.toLocaleString('es-CL')}` : '—'}
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => { setEditId(s.id); setForm({ rut: s.rut, nombre: s.nombre, telefono: s.telefono ?? '', fecha_ingreso: s.fecha_ingreso }) }}
                      className="text-blue-600 hover:underline">Editar</button>
                    {s.deudaTotal > 0 && s.telefono && (
                      <a href={s.whatsappUrl} target="_blank" rel="noreferrer"
                        className="text-green-600 hover:underline">WhatsApp</a>
                    )}
                    <button onClick={() => darDeBaja(s.id)}
                      className="text-red-500 hover:underline">Baja</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
