'use client'
import { useEffect, useState } from 'react'
import { supabase, type Movimiento, type TipoMovimiento } from '@/lib/supabase'
import { insertMovimiento, updateMovimiento } from '@/lib/movimientos'
import { getSession } from '@/lib/session'

const TIPOS: { value: TipoMovimiento; label: string }[] = [
  { value: 'pago_cuota', label: 'Pago de cuota' },
  { value: 'ingreso_extra', label: 'Ingreso extra' },
  { value: 'gasto', label: 'Gasto' },
]

const EMPTY: Omit<Movimiento, 'id' | 'creado_en'> = {
  tipo: 'pago_cuota',
  fecha_registro: new Date().toISOString().slice(0, 10),
  socio_id: null,
  mes_cuota: null,
  monto: 0,
  glosa: '',
  comprobante_url: null,
  creado_por: '',
}

export default function MovimientosPage() {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [socios, setSocios] = useState<{ id: string; nombre: string }[]>([])
  const [form, setForm] = useState<Omit<Movimiento, 'id' | 'creado_en'>>(EMPTY)
  const [editId, setEditId] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<TipoMovimiento | 'todos'>('todos')
  const session = getSession()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: movs }, { data: socs }] = await Promise.all([
      supabase.from('movimientos').select('*').order('fecha_registro', { ascending: false }),
      supabase.from('socios').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setMovimientos(movs ?? [])
    setSocios(socs ?? [])
  }

  async function guardar() {
    setError('')
    if (!form.glosa.trim()) { setError('La glosa es obligatoria.'); return }
    if (form.monto <= 0) { setError('El monto debe ser mayor a 0.'); return }
    if (form.tipo === 'pago_cuota' && (!form.socio_id || !form.mes_cuota)) {
      setError('Para un pago de cuota debes seleccionar socio y mes.'); return
    }

    let comprobante_url = form.comprobante_url
    if (file) {
      if (file.size > 5 * 1024 * 1024) { setError('El comprobante no puede superar 5MB.'); return }
      const path = `${Date.now()}-${file.name}`
      const { error: uploadError } = await supabase.storage.from('comprobantes').upload(path, file)
      if (uploadError) { setError(uploadError.message); return }
      const { data: urlData } = supabase.storage.from('comprobantes').getPublicUrl(path)
      comprobante_url = urlData.publicUrl
    }

    const payload = { ...form, comprobante_url, creado_por: session?.rut ?? '' }
    if (editId) {
      await updateMovimiento(editId, payload)
    } else {
      await insertMovimiento(payload)
    }
    setForm({ ...EMPTY, creado_por: session?.rut ?? '' })
    setEditId(null)
    setFile(null)
    cargar()
  }

  const filtrados = filtroTipo === 'todos'
    ? movimientos
    : movimientos.filter(m => m.tipo === filtroTipo)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Movimientos</h1>

      <div className="bg-white rounded-xl shadow p-4 space-y-3">
        <h2 className="font-semibold">{editId ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Tipo *</label>
            <select value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoMovimiento, socio_id: null, mes_cuota: null }))}
              className="w-full border rounded px-2 py-1 text-sm">
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">Fecha *</label>
            <input type="date" value={form.fecha_registro}
              onChange={e => setForm(f => ({ ...f, fecha_registro: e.target.value }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          {form.tipo === 'pago_cuota' && (
            <>
              <div>
                <label className="block text-sm mb-1">Socio *</label>
                <select value={form.socio_id ?? ''}
                  onChange={e => setForm(f => ({ ...f, socio_id: e.target.value || null }))}
                  className="w-full border rounded px-2 py-1 text-sm">
                  <option value="">Seleccionar...</option>
                  {socios.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">Mes que cubre *</label>
                <input type="month"
                  value={form.mes_cuota ? form.mes_cuota.slice(0, 7) : ''}
                  onChange={e => setForm(f => ({ ...f, mes_cuota: e.target.value ? e.target.value + '-01' : null }))}
                  className="w-full border rounded px-2 py-1 text-sm" />
              </div>
            </>
          )}
          <div>
            <label className="block text-sm mb-1">Monto *</label>
            <input type="number" value={form.monto || ''}
              onChange={e => setForm(f => ({ ...f, monto: Number(e.target.value) }))}
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-sm mb-1">Glosa *</label>
            <input value={form.glosa}
              onChange={e => setForm(f => ({ ...f, glosa: e.target.value }))}
              placeholder="Descripción del movimiento"
              className="w-full border rounded px-2 py-1 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="block text-sm mb-1">Comprobante (máx 5MB)</label>
            <input type="file" accept="image/*,.pdf"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm" />
          </div>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="flex gap-2">
          <button onClick={guardar}
            className="bg-blue-600 text-white px-4 py-1 rounded text-sm hover:bg-blue-700">
            {editId ? 'Guardar cambios' : 'Registrar'}
          </button>
          {editId && (
            <button onClick={() => { setEditId(null); setForm(EMPTY) }}
              className="px-4 py-1 rounded text-sm border hover:bg-gray-50">Cancelar</button>
          )}
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <span className="text-sm font-medium">Filtrar:</span>
        {(['todos', ...TIPOS.map(t => t.value)] as const).map(t => (
          <button key={t}
            onClick={() => setFiltroTipo(t as typeof filtroTipo)}
            className={`text-sm px-3 py-1 rounded-full border ${filtroTipo === t ? 'bg-blue-600 text-white border-blue-600' : 'hover:bg-gray-50'}`}>
            {t === 'todos' ? 'Todos' : TIPOS.find(x => x.value === t)?.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">Fecha</th>
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-left">Glosa</th>
              <th className="px-4 py-2 text-right">Monto</th>
              <th className="px-4 py-2 text-center">Comprobante</th>
              <th className="px-4 py-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Sin movimientos</td></tr>
            )}
            {filtrados.map(m => (
              <tr key={m.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2">{m.fecha_registro}</td>
                <td className="px-4 py-2">{TIPOS.find(t => t.value === m.tipo)?.label}</td>
                <td className="px-4 py-2">{m.glosa}</td>
                <td className={`px-4 py-2 text-right font-medium ${m.tipo === 'gasto' ? 'text-red-600' : 'text-green-600'}`}>
                  {m.tipo === 'gasto' ? '-' : '+'}${m.monto.toLocaleString('es-CL')}
                </td>
                <td className="px-4 py-2 text-center">
                  {m.comprobante_url && (
                    <a href={m.comprobante_url} target="_blank" rel="noreferrer"
                      className="text-blue-600 hover:underline">Ver</a>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    onClick={() => {
                      setEditId(m.id)
                      setForm({ tipo: m.tipo, fecha_registro: m.fecha_registro, socio_id: m.socio_id, mes_cuota: m.mes_cuota, monto: m.monto, glosa: m.glosa, comprobante_url: m.comprobante_url, creado_por: m.creado_por })
                    }}
                    className="text-blue-600 hover:underline">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
