import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC = ['/login', '/api/login', '/mi', '/api/cron'];
const COOKIE = 'clubpm_session';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Permitir assets y rutas públicas
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/logo') ||
    PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE)?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  try {
    const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
    await jwtVerify(token, secret);
    return NextResponse.next();
  } catch {
    const url = new URL('/login', req.url);
    const res = NextResponse.redirect(url);
    res.cookies.delete(COOKIE);
    return res;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo.*).*)'],
};
