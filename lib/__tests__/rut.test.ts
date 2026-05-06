import { describe, it, expect } from 'vitest';
import { normalizeRut, isValidRut, calcDv, formatRut } from '@/lib/rut';

describe('normalizeRut', () => {
  it('convierte "12.345.678-9" a "12345678-9"', () => {
    expect(normalizeRut('12.345.678-9')).toBe('12345678-9');
  });

  it('convierte "17.033.048-K" a "17033048-k" (dv minúscula)', () => {
    expect(normalizeRut('17.033.048-K')).toBe('17033048-k');
  });

  it('acepta RUT sin puntos ni guion', () => {
    expect(normalizeRut('123456789')).toBe('12345678-9');
  });

  it('acepta RUT con espacios', () => {
    expect(normalizeRut('  12.345.678-9  ')).toBe('12345678-9');
  });

  it('preserva la dv "k" siempre minúscula', () => {
    expect(normalizeRut('17033048-k')).toBe('17033048-k');
    expect(normalizeRut('17033048K')).toBe('17033048-k');
  });
});

describe('formatRut', () => {
  it('formatea para mostrar con puntos', () => {
    expect(formatRut('12345678-9')).toBe('12.345.678-9');
  });

  it('preserva dv k minúscula al formatear', () => {
    expect(formatRut('17033048-k')).toBe('17.033.048-k');
  });
});

describe('isValidRut', () => {
  it('rechaza RUT con dígito verificador equivocado', () => {
    expect(isValidRut('12345678-0')).toBe(false);
    expect(isValidRut('17353638-9')).toBe(false);
    expect(isValidRut('17033048-1')).toBe(false);
  });

  it('rechaza strings que no son RUT', () => {
    expect(isValidRut('')).toBe(false);
    expect(isValidRut('abc')).toBe(false);
    expect(isValidRut('1')).toBe(false);
  });

  it('acepta el RUT del admin del proyecto (17353638-0)', () => {
    expect(isValidRut('17353638-0')).toBe(true);
    expect(isValidRut('17.353.638-0')).toBe(true);
  });

  it('acepta RUT con dv "k"', () => {
    expect(isValidRut('17033048-k')).toBe(true);
    expect(isValidRut('17.033.048-K')).toBe(true);
  });

  // Genera 24 RUTs válidos calculando el DV correcto y verifica que
  // isValidRut los acepte (round-trip). Esto cubre la casuística que
  // tendría el Excel del proyecto sin depender de una lista hard-coded.
  it('acepta 24 RUTs sintéticos válidos (round-trip con calcDv)', () => {
    const cuerpos = [
      '5826473', '6193822', '7421856', '8345091', '9128345', '10123456',
      '11456789', '12345678', '13987654', '14111222', '15333444', '16555666',
      '17353638', '17033048', '18222111', '18999000', '19111222', '19888777',
      '20111000', '20999888', '21333444', '22555111', '23000999', '24111888',
    ];
    expect(cuerpos.length).toBe(24);
    for (const cuerpo of cuerpos) {
      const dv = calcDv(cuerpo);
      const rut = `${cuerpo}-${dv}`;
      expect(isValidRut(rut), `falló para ${rut}`).toBe(true);
      expect(isValidRut(formatRut(rut)), `falló formateado: ${formatRut(rut)}`).toBe(true);
    }
  });

  it('rechaza si se altera el DV de un RUT válido', () => {
    const cuerpo = '17353638';
    const dvCorrecto = calcDv(cuerpo);
    const dvIncorrecto = dvCorrecto === '0' ? '1' : '0';
    expect(isValidRut(`${cuerpo}-${dvCorrecto}`)).toBe(true);
    expect(isValidRut(`${cuerpo}-${dvIncorrecto}`)).toBe(false);
  });
});
