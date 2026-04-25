/**
 * Utilidades para RUT chileno.
 * Formato canónico que guardamos en BD: "12345678-9" (sin puntos, con guion, dv minúscula si es k)
 */

/** Limpia el RUT: deja solo dígitos y dv. */
export function cleanRut(rut: string): string {
  return rut.replace(/[^0-9kK]/g, '').toLowerCase();
}

/** Calcula el dígito verificador de un cuerpo numérico. */
export function calcDv(body: string): string {
  let sum = 0;
  let mul = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mul;
    mul = mul === 7 ? 2 : mul + 1;
  }
  const res = 11 - (sum % 11);
  if (res === 11) return '0';
  if (res === 10) return 'k';
  return String(res);
}

/** Valida un RUT completo. Acepta cualquier formato de entrada. */
export function isValidRut(rut: string): boolean {
  const clean = cleanRut(rut);
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;
  return calcDv(body) === dv;
}

/** Devuelve el RUT en formato canónico para BD: "12345678-9". */
export function normalizeRut(rut: string): string {
  const clean = cleanRut(rut);
  if (clean.length < 2) return clean;
  return `${clean.slice(0, -1)}-${clean.slice(-1)}`;
}

/** Devuelve el RUT formateado para mostrar: "12.345.678-9". */
export function formatRut(rut: string): string {
  const clean = cleanRut(rut);
  if (clean.length < 2) return rut;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const bodyDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${bodyDots}-${dv}`;
}
