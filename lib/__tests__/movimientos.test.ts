import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { calcularEstado, calcularDashboard } from '@/lib/movimientos';
import type { Socio, Movimiento, CuotaConfig, AjusteCuota } from '@/lib/supabase';

function makeSocio(overrides: Partial<Socio> = {}): Socio {
  return {
    id: 'socio-1',
    rut: '12345678-5',
    nombre: 'Test Socio',
    telefono: null,
    fecha_ingreso: '2024-01-01',
    activo: true,
    es_admin: false,
    pin_hash: null,
    ...overrides,
  };
}

function makePago(overrides: Partial<Movimiento> = {}): Movimiento {
  return {
    id: `mov-${Math.random()}`,
    tipo: 'pago_cuota',
    fecha_registro: '2024-08-15',
    socio_id: 'socio-1',
    mes_cuota: '2024-08-01',
    monto: 10000,
    glosa: '',
    comprobante_url: null,
    creado_en: '2024-08-15T12:00:00Z',
    creado_por: 'test',
    ...overrides,
  };
}

function makeCuota(mes: string, monto = 10000): CuotaConfig {
  return { id: `cuota-${mes}`, mes, monto };
}

function makeAjuste(socioId: string, mes: string, monto: number, glosa = 'test'): AjusteCuota {
  return {
    id: `ajuste-${socioId}-${mes}`,
    socio_id: socioId,
    mes,
    monto,
    glosa,
    creado_en: '2026-05-06T12:00:00Z',
    creado_por: '17353638-0',
  };
}

describe('calcularEstado', () => {
  it('socio inactivo → estado "inactivo"', () => {
    const socio = makeSocio({ activo: false, fecha_ingreso: '2023-01-01' });
    const r = calcularEstado(socio, [], [], [], '2024-09-01');
    expect(r.estado).toBe('inactivo');
    expect(r.mesesAdeudados).toEqual([]);
    expect(r.montoAdeudado).toBe(0);
  });

  it('socio activo que pagó este mes → "al_dia"', () => {
    const socio = makeSocio({ fecha_ingreso: '2024-09-01' });
    const movs = [makePago({ mes_cuota: '2024-09-01', fecha_registro: '2024-09-05' })];
    const cuotas = [makeCuota('2024-09-01')];
    const r = calcularEstado(socio, movs, cuotas, [], '2024-09-01');
    expect(r.estado).toBe('al_dia');
    expect(r.mesesAdeudados).toEqual([]);
    expect(r.montoAdeudado).toBe(0);
  });

  it('socio activo que aún no paga este mes pero está al día con anteriores → "pendiente"', () => {
    // Socio ingresó en jul-2024, pagó jul y ago, aún no paga sep (mes ref).
    const socio = makeSocio({ fecha_ingreso: '2024-07-01' });
    const movs = [
      makePago({ mes_cuota: '2024-07-01', fecha_registro: '2024-07-10' }),
      makePago({ mes_cuota: '2024-08-01', fecha_registro: '2024-08-10' }),
    ];
    const cuotas = [
      makeCuota('2024-07-01'),
      makeCuota('2024-08-01'),
      makeCuota('2024-09-01'),
    ];
    const r = calcularEstado(socio, movs, cuotas, [], '2024-09-01');
    expect(r.estado).toBe('pendiente');
    expect(r.mesesAdeudados).toEqual([]);
  });

  it('socio activo con 2 meses sin pagar → "moroso" con mesesAdeudados.length === 2', () => {
    // Socio ingresó en jul-2024, no pagó jul ni ago. Ref: sep-2024.
    const socio = makeSocio({ fecha_ingreso: '2024-07-01' });
    const cuotas = [
      makeCuota('2024-07-01', 10000),
      makeCuota('2024-08-01', 10000),
      makeCuota('2024-09-01', 10000),
    ];
    const r = calcularEstado(socio, [], cuotas, [], '2024-09-01');
    expect(r.estado).toBe('moroso');
    expect(r.mesesAdeudados).toHaveLength(2);
    expect(r.mesesAdeudados).toEqual(['2024-07-01', '2024-08-01']);
    expect(r.montoAdeudado).toBe(20000);
  });

  it('fix de timezone: fecha_ingreso "2024-08-01" NO genera jul-2024 como mes adeudado', () => {
    // Bug original: new Date('2024-08-01') se parsea como UTC y en Chile (UTC-3)
    // se convierte en 2024-07-31, lo que generaba un "mes esperado" extra (jul-2024).
    // El fix usa T12:00:00 para forzar mediodía local, que cae en agosto en cualquier TZ.
    const socio = makeSocio({ fecha_ingreso: '2024-08-01' });
    const cuotas = [makeCuota('2024-08-01'), makeCuota('2024-09-01')];

    const r = calcularEstado(socio, [], cuotas, [], '2024-09-01');

    expect(r.mesesAdeudados).not.toContain('2024-07-01');
    expect(r.mesesAdeudados).toEqual(['2024-08-01']);
    expect(r.estado).toBe('moroso');
  });

  it('fix de timezone (final de mes): fecha_ingreso "2024-08-31" NO se corre a sep-2024', () => {
    // Caso simétrico: si el parsing UTC corriera la fecha al día siguiente,
    // un ingreso 2024-08-31 podría aparecer como sep-2024. T12:00:00 lo evita.
    const socio = makeSocio({ fecha_ingreso: '2024-08-31' });
    const cuotas = [makeCuota('2024-08-01'), makeCuota('2024-09-01')];

    const r = calcularEstado(socio, [], cuotas, [], '2024-09-01');

    // El socio debe deber agosto (su mes de ingreso), no estar inscrito en septiembre.
    expect(r.mesesAdeudados).toEqual(['2024-08-01']);
  });

  it('cuenta como moroso solo meses pasados, no el mes en curso', () => {
    // Socio sin pagos. Mes ref = oct-2024. Debió pagar ago, sep (pasados) y oct (actual).
    // Solo ago y sep cuentan como adeudados; oct está "pendiente".
    const socio = makeSocio({ fecha_ingreso: '2024-08-01' });
    const cuotas = [makeCuota('2024-08-01'), makeCuota('2024-09-01'), makeCuota('2024-10-01')];

    const r = calcularEstado(socio, [], cuotas, [], '2024-10-01');

    expect(r.mesesAdeudados).toEqual(['2024-08-01', '2024-09-01']);
    expect(r.estado).toBe('moroso');
  });

  it('ajuste con monto=0 omite el mes del cálculo', () => {
    const socio = makeSocio({ id: 's-pat', fecha_ingreso: '2024-07-01' });
    const cuotas = [
      makeCuota('2024-07-01'),
      makeCuota('2024-08-01'),
      makeCuota('2024-09-01'),
    ];
    const ajustes = [
      makeAjuste('s-pat', '2024-08-01', 0, 'mudanza'),
    ];

    const r = calcularEstado(socio, [], cuotas, ajustes, '2024-09-01');

    expect(r.mesesAdeudados).toEqual(['2024-07-01']);
    expect(r.mesesAdeudados).not.toContain('2024-08-01');
    expect(r.estado).toBe('moroso');
  });

  it('ajuste con monto>0 cambia el monto adeudado del mes', () => {
    const socio = makeSocio({ id: 's-beca', fecha_ingreso: '2024-07-01' });
    const cuotas = [
      makeCuota('2024-07-01', 7000),
      makeCuota('2024-08-01', 7000),
    ];
    const ajustes = [
      makeAjuste('s-beca', '2024-07-01', 3500, 'beca media'),
    ];

    const r = calcularEstado(socio, [], cuotas, ajustes, '2024-08-01');

    expect(r.mesesAdeudados).toEqual(['2024-07-01']);
    expect(r.montoAdeudado).toBe(3500);
    expect(r.estado).toBe('moroso');
  });

  it('ajuste + pago_cuota del mismo mes deja el mes saldado', () => {
    const socio = makeSocio({ id: 's-x', fecha_ingreso: '2024-07-01' });
    const cuotas = [makeCuota('2024-07-01', 7000), makeCuota('2024-08-01', 7000)];
    const ajustes = [makeAjuste('s-x', '2024-07-01', 3500, 'beca media')];
    const movs = [
      makePago({ socio_id: 's-x', mes_cuota: '2024-07-01', monto: 3500, fecha_registro: '2024-07-10' }),
    ];

    const r = calcularEstado(socio, movs, cuotas, ajustes, '2024-08-01');

    expect(r.mesesAdeudados).toEqual([]);
    expect(r.estado).toBe('pendiente');
  });

  it('caso Patricio: 21 ajustes a $0 → no moroso', () => {
    const socio = makeSocio({ id: 's-pat', fecha_ingreso: '2024-08-01' });
    const meses = [
      '2024-08-01','2024-09-01','2024-10-01','2024-11-01','2024-12-01',
      '2025-01-01','2025-02-01','2025-03-01','2025-04-01','2025-05-01',
      '2025-06-01','2025-07-01','2025-08-01','2025-09-01','2025-10-01',
      '2025-11-01','2025-12-01','2026-01-01','2026-02-01','2026-03-01',
      '2026-04-01',
    ];
    const cuotas = meses.map((m) => makeCuota(m, 7000));
    const ajustes = meses.map((m) => makeAjuste('s-pat', m, 0, 'mudanza'));

    const r = calcularEstado(socio, [], cuotas, ajustes, '2026-05-01');

    expect(r.mesesAdeudados).toEqual([]);
    expect(r.montoAdeudado).toBe(0);
    expect(r.estado).toBe('pendiente');
  });
});

describe('calcularDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fijar "ahora" a mediados de septiembre 2024 para que mesActual() = '2024-09-01'.
    vi.setSystemTime(new Date('2024-09-15T12:00:00'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('con 3 socios (1 al día, 1 moroso, 1 inactivo) devuelve métricas correctas', () => {
    const socios: Socio[] = [
      makeSocio({ id: 's-aldia', fecha_ingreso: '2024-09-01' }),
      makeSocio({ id: 's-moroso', fecha_ingreso: '2024-07-01' }),
      makeSocio({ id: 's-inactivo', fecha_ingreso: '2024-01-01', activo: false }),
    ];
    const movs: Movimiento[] = [
      // Socio al día: pagó septiembre.
      makePago({
        id: 'p1',
        socio_id: 's-aldia',
        mes_cuota: '2024-09-01',
        fecha_registro: '2024-09-10',
        monto: 10000,
      }),
    ];
    const cuotas = [
      makeCuota('2024-07-01'),
      makeCuota('2024-08-01'),
      makeCuota('2024-09-01'),
    ];

    const r = calcularDashboard(socios, movs, cuotas, []);

    expect(r.sociosActivos).toBe(2);
    expect(r.pagaronEsteMes).toBe(1);
    expect(r.morosos).toBe(1);
    expect(r.inactivos).toBe(1);
    expect(r.recaudadoMes).toBe(10000);
    expect(r.morososDetalle).toHaveLength(1);
    expect(r.morososDetalle[0].socio.id).toBe('s-moroso');
    expect(r.morososDetalle[0].mesesAdeudados).toEqual(['2024-07-01', '2024-08-01']);
    expect(r.morososDetalle[0].montoAdeudado).toBe(20000);
  });

  it('recaudadoMes solo cuenta pagos cuya fecha_registro cae en el mes actual', () => {
    const socios: Socio[] = [makeSocio({ id: 's-1', fecha_ingreso: '2024-01-01' })];
    const movs: Movimiento[] = [
      makePago({ id: 'm-ago', socio_id: 's-1', mes_cuota: '2024-08-01', fecha_registro: '2024-08-15', monto: 10000 }),
      makePago({ id: 'm-sep', socio_id: 's-1', mes_cuota: '2024-09-01', fecha_registro: '2024-09-10', monto: 10000 }),
      makePago({ id: 'm-oct', socio_id: 's-1', mes_cuota: '2024-10-01', fecha_registro: '2024-10-01', monto: 10000 }),
    ];
    const cuotas = [makeCuota('2024-09-01')];

    const r = calcularDashboard(socios, movs, cuotas, []);

    // Ahora simulado = 2024-09-15, recaudación de septiembre = solo m-sep.
    expect(r.recaudadoMes).toBe(10000);
  });
});
