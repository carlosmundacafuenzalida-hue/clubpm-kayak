import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'clubpm_session';
const ALG = 'HS256';

function getKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET no está definido en .env.local');
  return new TextEncoder().encode(secret);
}

export type Session = {
  socio_id: string;
  rut: string;
  nombre: string;
  es_admin: boolean;
};

/** Crea sesión: firma JWT y la mete en cookie httpOnly. Llamar desde Server Action / Route Handler. */
export async function createSession(payload: Session) {
  const token = await new SignJWT(payload as any)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getKey());

  const c = await cookies();
  c.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 días
  });
}

/** Lee la sesión activa, o null si no hay/expiró. */
export async function getSession(): Promise<Session | null> {
  try {
    const c = await cookies();
    const token = c.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getKey());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

/** Cierra sesión. */
export async function destroySession() {
  const c = await cookies();
  c.delete(COOKIE_NAME);
}
