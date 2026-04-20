'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { normalizeRut } from '@/lib/rut'
import { saveSession } from '@/lib/session'
import { RutInput } from '@/components/RutInput'

export default function LoginPage() {
  const router = useRouter()
  const [rut, setRut] = useState('')
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const normalized = normalizeRut(rut)

    const { data: socio, error: dbError } = await supabase
      .from('socios')
      .select('id, rut, nombre, es_admin, pin_hash, activo')
      .eq('rut', normalized)
      .single()

    if (dbError || !socio) {
      setError('RUT no registrado. Contacta al tesorero.')
      setLoading(false)
      return
    }
    if (!socio.activo) {
      setError('Este socio está dado de baja.')
      setLoading(false)
      return
    }
    if (socio.es_admin) {
      if (!showPin) { setShowPin(true); setLoading(false); return }
      const { data: pinOk } = await supabase.rpc('verify_pin', { p_rut: normalized, p_pin: pin })
      if (!pinOk) {
        setError('PIN incorrecto.')
        setLoading(false)
        return
      }
    }

    saveSession({ rut: socio.rut, nombre: socio.nombre, esAdmin: socio.es_admin })
    router.push(socio.es_admin ? '/admin' : '/socio')
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">Club Cuotas</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">RUT</label>
            <RutInput
              value={rut}
              onChange={setRut}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {showPin && (
            <div>
              <label className="block text-sm font-medium mb-1">PIN</label>
              <input
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                maxLength={8}
              />
            </div>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </main>
  )
}
