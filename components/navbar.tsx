'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BrandMark, BrandWordmark } from './brand';

export function Navbar({ nombre }: { nombre: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/socios', label: 'Socios' },
    { href: '/movimientos', label: 'Movimientos' },
    { href: '/importar', label: 'Importar' },
    { href: '/configuracion', label: 'Configuración' },
  ];

  const initials = nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

  async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="bg-bosque text-white border-b border-kayak/20 sticky top-0 z-50">
      <div className="max-w-[1320px] mx-auto px-8 py-3 flex items-center gap-12">
        <Link href="/dashboard" className="flex items-center gap-3 flex-shrink-0">
          <BrandMark size={36} />
          <BrandWordmark />
        </Link>
        <nav className="flex gap-1 flex-1">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + '/');
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-4 py-2 text-[13px] font-medium rounded-md transition ${
                  active
                    ? 'text-kayak bg-kayak/10'
                    : 'text-white/65 hover:text-white hover:bg-white/5'
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={logout}
          className="flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 bg-white/5 rounded-full hover:bg-white/10 transition text-[13px]"
          title="Cerrar sesión"
        >
          <span className="w-7 h-7 rounded-full bg-kayak text-bosque flex items-center justify-center font-bold text-[11px] font-display">
            {initials}
          </span>
          <span className="text-white">{nombre.split(' ')[0]}</span>
        </button>
      </div>
    </header>
  );
}
