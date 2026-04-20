import { describe, it, expect } from 'vitest'
import { calcularEstadoMes, calcularEstadoGeneral, generarMesesDesdeInicio } from '@/lib/movimientos'

describe('calcularEstadoMes', () => {
  it('al día cuando pagado >= monto', () => {
    expect(calcularEstadoMes(15000, 15000)).toBe('al_dia')
    expect(calcularEstadoMes(20000, 15000)).toBe('al_dia')
  })
  it('deuda parcial cuando 0 < pagado < monto', () => {
    expect(calcularEstadoMes(5000, 15000)).toBe('parcial')
  })
  it('impago cuando pagado = 0', () => {
    expect(calcularEstadoMes(0, 15000)).toBe('impago')
  })
})

describe('generarMesesDesdeInicio', () => {
  it('genera lista de meses desde ago 2024 hasta fecha dada', () => {
    const meses = generarMesesDesdeInicio(new Date('2024-10-01'))
    expect(meses[0]).toBe('2024-08-01')
    expect(meses[meses.length - 1]).toBe('2024-10-01')
    expect(meses.length).toBe(3)
  })
})

describe('calcularEstadoGeneral', () => {
  it('al día si todos los meses están al día', () => {
    expect(calcularEstadoGeneral(['al_dia', 'al_dia'])).toBe('al_dia')
  })
  it('moroso si algún mes tiene impago', () => {
    expect(calcularEstadoGeneral(['al_dia', 'impago'])).toBe('moroso')
  })
  it('parcial si hay deuda pero no impago completo', () => {
    expect(calcularEstadoGeneral(['al_dia', 'parcial'])).toBe('parcial')
  })
})
