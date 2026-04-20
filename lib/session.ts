export interface SessionData {
  rut: string
  nombre: string
  esAdmin: boolean
}

const SESSION_KEY = 'club_session'

export function saveSession(data: SessionData): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data))
}

export function getSession(): SessionData | null {
  if (typeof window === 'undefined') return null
  const raw = sessionStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SessionData
  } catch {
    return null
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_KEY)
}
