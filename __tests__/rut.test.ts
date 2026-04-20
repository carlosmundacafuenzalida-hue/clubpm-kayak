import { describe, it, expect } from 'vitest'
import { normalizeRut, validateRut } from '@/lib/rut'

describe('normalizeRut', () => {
  it('elimina puntos y conserva guión', () => {
    expect(normalizeRut('12.345.678-9')).toBe('12345678-9')
  })
  it('agrega guión si falta', () => {
    expect(normalizeRut('123456789')).toBe('12345678-9')
  })
  it('maneja K minúscula en dígito verificador', () => {
    expect(normalizeRut('76354771k')).toBe('76354771-k')
  })
  it('devuelve vacío para entrada vacía', () => {
    expect(normalizeRut('')).toBe('')
  })
})

describe('validateRut', () => {
  it('valida RUT con dígito verificador correcto', () => {
    expect(validateRut('76354771-k')).toBe(true)
  })
  it('rechaza RUT con dígito verificador incorrecto', () => {
    expect(validateRut('12345678-9')).toBe(false)
  })
  it('rechaza RUT malformado', () => {
    expect(validateRut('abc')).toBe(false)
  })
})
