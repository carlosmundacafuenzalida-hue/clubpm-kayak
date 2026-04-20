export function normalizeRut(raw: string): string {
  if (!raw) return ''
  const clean = raw.replace(/\./g, '').replace(/-/g, '').toLowerCase()
  if (clean.length < 2) return clean
  const body = clean.slice(0, -1)
  const dv = clean.slice(-1)
  return `${body}-${dv}`
}

export function validateRut(rut: string): boolean {
  const normalized = normalizeRut(rut)
  const match = normalized.match(/^(\d+)-([0-9k])$/)
  if (!match) return false
  const [, body, dv] = match
  let sum = 0
  let mul = 2
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * mul
    mul = mul === 7 ? 2 : mul + 1
  }
  const remainder = 11 - (sum % 11)
  const expected = remainder === 11 ? '0' : remainder === 10 ? 'k' : String(remainder)
  return dv === expected
}
