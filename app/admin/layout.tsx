'use client'
import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { getSession, clearSession } from '@/lib/session'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const session = getSession()
    if (!session?.esAdmin) router.push('/login')
  }, [router])

  const navItems = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/socios', label: 'Socios' },
    { href: '/admin/movimientos', label: 'Movimientos' },
    { href: '/admin/reportes', label: 'Reportes' },
    { href: '/admin/configuracion', label: 'Configuración' },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-700 text-white px-6 py-3 flex gap-6 items-center">
        <span className="font-bold mr-4">Club Cuotas</span>
        {navItems.map(item => (
          <Link key={item.href} href={item.href}
            className={`text-sm hover:underline ${pathname === item.href ? 'font-bold underline' : ''}`}>
            {item.label}
          </Link>
        ))}
        <button onClick={() => { clearSession(); router.push('/login') }}
          className="ml-auto text-sm hover:underline">Salir</button>
      </nav>
      <main className="max-w-5xl mx-auto p-6">{children}</main>
    </div>
  )
}
