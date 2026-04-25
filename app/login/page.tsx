'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RutInput } from '@/components/rut-input';
import { PinInput } from '@/components/pin-input';
import { BrandMark, BrandWordmark } from '@/components/brand';

export default function LoginPage() {
  const [rut, setRut] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rut, pin }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Error al ingresar');
        setLoading(false);
        return;
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('No se pudo conectar al servidor');
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper flex items-center justify-center p-6">
      <div className="w-full max-w-[920px] bg-white rounded-2xl shadow-lg overflow-hidden border border-line grid md:grid-cols-[5fr_7fr] min-h-[560px]">
        {/* Lado decorativo */}
        <aside className="bg-gradient-to-br from-bosque to-bosque-deep text-white p-12 flex flex-col justify-between relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-60 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 80% 20%, rgba(168, 216, 232, 0.12) 0%, transparent 50%), radial-gradient(circle at 20% 80%, rgba(245, 200, 66, 0.08) 0%, transparent 50%)',
            }}
          />

          <div className="relative">
            <div className="flex items-center gap-3 mb-14">
              <BrandMark size={42} />
              <BrandWordmark />
            </div>
            <p className="font-display text-[36px] leading-[1.15] italic font-normal -tracking-[0.02em]">
              "El río no apura<br/>
              pero <em className="text-kayak">siempre llega</em>."
            </p>
          </div>

          {/* Montaña SVG */}
          <svg
            viewBox="0 0 600 200"
            preserveAspectRatio="none"
            className="absolute bottom-0 left-0 right-0 opacity-15 pointer-events-none"
          >
            <path d="M0,200 L0,140 L80,80 L150,110 L220,40 L320,90 L420,30 L520,80 L600,60 L600,200 Z" fill="#F5C842"/>
            <path d="M0,200 L0,160 L100,120 L180,150 L260,90 L360,130 L460,80 L540,120 L600,100 L600,200 Z" fill="#A8D8E8" opacity="0.6"/>
          </svg>

          <div className="relative text-[13px] text-white/50">
            <strong className="block text-white font-medium text-sm mb-0.5">Acceso del tesorero</strong>
            Ingreso restringido — Club PM Kayak
          </div>
        </aside>

        {/* Form */}
        <section className="p-12 flex flex-col justify-center min-w-0">
          <p className="font-mono text-[11px] text-verde uppercase tracking-[0.16em] mb-3">
            Identifícate
          </p>
          <h1 className="font-display text-[38px] font-medium leading-[1.05] -tracking-[0.03em] text-bosque mb-2">
            Bienvenido de <em className="italic text-verde">vuelta</em>
          </h1>
          <p className="text-ink-soft mb-9 text-sm">
            Ingresa tu RUT y PIN de 4 dígitos para acceder a la plataforma.
          </p>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
                RUT del socio
              </label>
              <RutInput value={rut} onChange={setRut} />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted uppercase tracking-[0.1em] mb-2">
                PIN de acceso
              </label>
              <PinInput value={pin} onChange={setPin} />
            </div>

            {error && (
              <div className="text-rojo text-sm bg-rojo-soft border border-rojo/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || pin.length !== 4 || !rut}
              className="w-full py-4 bg-bosque text-white rounded-md font-semibold shadow-md hover:bg-verde hover:-translate-y-0.5 transition disabled:opacity-40 disabled:hover:translate-y-0 flex items-center justify-center gap-2"
            >
              {loading ? 'Ingresando...' : 'Ingresar al sistema'}
              {!loading && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
