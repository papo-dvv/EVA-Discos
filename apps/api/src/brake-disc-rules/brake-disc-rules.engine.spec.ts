import {
  BrakeDiscRulesEngine,
  calcularRd,
  type MedicionDisco,
} from './brake-disc-rules.engine';
import { UMBRALES_POR_DEFECTO } from './umbrales';

// Umbrales por defecto usados en casi todos los casos:
// rdUmbralOk=1.00, rdUmbralSeguimiento=0.40, rdUmbralCritico=0.00,
// hUmbralReperfilado=1.60, reperfiladoDescuentoRd=0.80
const engine = new BrakeDiscRulesEngine(UMBRALES_POR_DEFECTO);

describe('calcularRd', () => {
  it('retorna t - h', () => {
    expect(calcularRd(12.4, 3.8)).toBeCloseTo(8.6);
    expect(engine.calcularRd(12.4, 3.8)).toBeCloseTo(8.6);
  });

  it('puede dar un resultado negativo (H mayor que T)', () => {
    expect(engine.calcularRd(3.0, 7.9)).toBeCloseTo(-4.9);
  });

  it('da cero cuando T y H son iguales', () => {
    expect(engine.calcularRd(5, 5)).toBe(0);
  });
});

describe('clasificarEstado', () => {
  it('OK cuando rd >= rd_umbral_ok', () => {
    expect(engine.clasificarEstado(1.5)).toBe('OK');
  });

  it('límite exacto: rd == rd_umbral_ok (1.00) es OK, no Seguimiento', () => {
    expect(engine.clasificarEstado(1.0)).toBe('OK');
  });

  it('justo debajo de rd_umbral_ok es Seguimiento', () => {
    expect(engine.clasificarEstado(0.999999)).toBe('SEGUIMIENTO');
  });

  it('Seguimiento en el medio del rango (rd_umbral_seguimiento < rd < rd_umbral_ok)', () => {
    expect(engine.clasificarEstado(0.7)).toBe('SEGUIMIENTO');
  });

  it('límite exacto: rd == rd_umbral_seguimiento (0.40) es Cambio, no Seguimiento', () => {
    expect(engine.clasificarEstado(0.4)).toBe('CAMBIO');
  });

  it('justo arriba de rd_umbral_seguimiento es Seguimiento', () => {
    expect(engine.clasificarEstado(0.400001)).toBe('SEGUIMIENTO');
  });

  it('Cambio en el medio del rango (0 < rd <= rd_umbral_seguimiento)', () => {
    expect(engine.clasificarEstado(0.2)).toBe('CAMBIO');
  });

  it('justo arriba de 0 es Cambio', () => {
    expect(engine.clasificarEstado(0.000001)).toBe('CAMBIO');
  });

  it('límite exacto: rd == 0 es Crítico', () => {
    expect(engine.clasificarEstado(0)).toBe('CRITICO');
  });

  it('rd negativo es Crítico', () => {
    expect(engine.clasificarEstado(-1.2)).toBe('CRITICO');
  });

  it('usa los umbrales inyectados, no valores fijos internos', () => {
    const engineCustom = new BrakeDiscRulesEngine({
      rdUmbralOk: 2.0,
      rdUmbralSeguimiento: 1.0,
      rdUmbralCritico: 0.0,
      hUmbralReperfilado: 1.6,
      reperfiladoDescuentoRd: 0.8,
    });

    // Con los umbrales por defecto, 1.5 sería OK; con estos umbrales custom, es Seguimiento.
    expect(engineCustom.clasificarEstado(1.5)).toBe('SEGUIMIENTO');
  });

  it('lee rd_umbral_critico desde los umbrales inyectados, no hardcodeado en 0', () => {
    const engineCustom = new BrakeDiscRulesEngine({
      ...UMBRALES_POR_DEFECTO,
      rdUmbralCritico: -0.05,
    });

    // Antes del wiring, -0.03 <= 0 (hardcode) clasificaba CRITICO. Con
    // rd_umbral_critico=-0.05, -0.03 > -0.05 -> ya no es Crítico, cae en
    // Cambio (0 < rd, rd <= rd_umbral_seguimiento).
    expect(engineCustom.clasificarEstado(-0.03)).toBe('CAMBIO');
  });
});

describe('clasificarEstadoConReperfilado', () => {
  it('Rd <= 0 es CRITICO incondicional, sin importar H', () => {
    expect(engine.clasificarEstadoConReperfilado(-0.1, 2.0)).toBe('CRITICO');
  });

  it('rd=0 con H alto también es CRITICO (Rd manda, no H)', () => {
    expect(engine.clasificarEstadoConReperfilado(0, 2.0)).toBe('CRITICO');
  });

  it('H suficiente y el reperfilado deja el Rd por encima de Seguimiento -> REPERFILADO (sobreescribe lo que Rd solo daría OK)', () => {
    // rd=1.5 solo -> OK (>= rd_umbral_ok); con h=1.8 >= 1.6 y 1.5-0.8=0.7 > 0.4 -> REPERFILADO
    expect(engine.clasificarEstadoConReperfilado(1.5, 1.8)).toBe('REPERFILADO');
  });

  it('límite exacto: Rd=1.20/H=1.8 -> CAMBIO, no REPERFILADO (1.20-0.80=0.40 no es > 0.40, comparación estricta)', () => {
    expect(engine.clasificarEstadoConReperfilado(1.2, 1.8)).toBe('CAMBIO');
  });

  it('Rd=0.30/H=1.7: el reperfilado hunde a -0.5 (<= 0.40) -> CAMBIO', () => {
    expect(engine.clasificarEstadoConReperfilado(0.3, 1.7)).toBe('CAMBIO');
  });

  it('Rd=1.20/H=1.0 (H no llega al umbral) -> clasificación normal, OK (no activa la regla de reperfilado)', () => {
    expect(engine.clasificarEstadoConReperfilado(1.2, 1.0)).toBe('OK');
  });

  it('sin H suficiente, cae en clasificarEstado puro para los otros 3 estados también', () => {
    expect(engine.clasificarEstadoConReperfilado(0.7, 1.0)).toBe('SEGUIMIENTO');
    expect(engine.clasificarEstadoConReperfilado(0.2, 1.0)).toBe('CAMBIO');
  });

  it('límite exacto: H == h_umbral_reperfilado (1.60) ya cuenta como "H suficiente"', () => {
    expect(engine.clasificarEstadoConReperfilado(1.5, 1.6)).toBe('REPERFILADO');
  });

  it('lee rd_umbral_critico desde los umbrales inyectados, no hardcodeado en 0 (usada por Migración y Mediciones)', () => {
    const engineCustom = new BrakeDiscRulesEngine({
      ...UMBRALES_POR_DEFECTO,
      rdUmbralCritico: -0.05,
    });

    // Antes del wiring, -0.03 <= 0 (hardcode) clasificaba CRITICO. Con
    // rd_umbral_critico=-0.05, -0.03 > -0.05 -> ya no es Crítico, cae en
    // Cambio (H=1.0 no llega a h_umbral_reperfilado, clasificación normal).
    expect(engineCustom.clasificarEstadoConReperfilado(-0.03, 1.0)).toBe(
      'CAMBIO',
    );
  });

  it('justo debajo de h_umbral_reperfilado no activa la regla de reperfilado', () => {
    expect(engine.clasificarEstadoConReperfilado(1.5, 1.599999)).toBe('OK');
  });
});

describe('evaluarAccionRecomendada', () => {
  it('NINGUNA cuando ambos discos están OK y sin desgaste de H', () => {
    const izquierdo: MedicionDisco = { rd: 1.5, h: 1.0 };
    const derecho: MedicionDisco = { rd: 1.3, h: 1.0 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'NINGUNA',
      ladoAfectado: null,
    });
  });

  it('CRITICO/ambos cuando solo el izquierdo tiene rd <= 0', () => {
    const izquierdo: MedicionDisco = { rd: -0.1, h: 1.0 };
    const derecho: MedicionDisco = { rd: 1.5, h: 1.0 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'CRITICO',
      ladoAfectado: 'ambos',
    });
  });

  it('CRITICO/ambos cuando solo el derecho tiene rd <= 0', () => {
    const izquierdo: MedicionDisco = { rd: 1.5, h: 1.0 };
    const derecho: MedicionDisco = { rd: 0, h: 1.0 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'CRITICO',
      ladoAfectado: 'ambos',
    });
  });

  it('CRITICO/ambos cuando los dos lados tienen rd <= 0', () => {
    const izquierdo: MedicionDisco = { rd: -1, h: 1.0 };
    const derecho: MedicionDisco = { rd: -2, h: 1.0 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'CRITICO',
      ladoAfectado: 'ambos',
    });
  });

  it('REPERFILADO/izquierdo cuando solo el izquierdo tiene H suficiente y el descuento no lo hunde', () => {
    // h=1.8 >= 1.6; rd=1.5 - 0.8 = 0.7 > 0.4 (rd_umbral_seguimiento) -> viable
    const izquierdo: MedicionDisco = { rd: 1.5, h: 1.8 };
    // h=1.0 < 1.6 -> ni siquiera entra a evaluación de reperfilado
    const derecho: MedicionDisco = { rd: 1.5, h: 1.0 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'REPERFILADO',
      ladoAfectado: 'izquierdo',
    });
  });

  it('REPERFILADO/derecho cuando solo el derecho tiene H suficiente y el descuento no lo hunde', () => {
    const izquierdo: MedicionDisco = { rd: 1.5, h: 1.0 };
    const derecho: MedicionDisco = { rd: 1.5, h: 1.8 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'REPERFILADO',
      ladoAfectado: 'derecho',
    });
  });

  it('ambos lados con H suficiente pero resultados distintos: uno viable y otro no -> gana CAMBIO/ambos', () => {
    // izquierdo: h suficiente y el descuento deja el Rd por ENCIMA del umbral -> "viable" por sí solo
    const izquierdo: MedicionDisco = { rd: 1.5, h: 1.8 };
    // derecho: h suficiente pero el descuento lo hunde a (o bajo) Seguimiento -> "insuficiente"
    const derecho: MedicionDisco = { rd: 1.0, h: 1.7 };

    // La condición "insuficiente" del derecho tiene prioridad (paso b) sobre el
    // reperfilado viable del izquierdo (paso c): el resultado NO puede ser
    // REPERFILADO solo porque un lado calificara de forma aislada.
    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'CAMBIO',
      ladoAfectado: 'ambos',
    });
  });

  it('REPERFILADO/ambos cuando los dos lados son viables de forma independiente', () => {
    const izquierdo: MedicionDisco = { rd: 1.5, h: 1.8 };
    const derecho: MedicionDisco = { rd: 1.4, h: 1.7 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'REPERFILADO',
      ladoAfectado: 'ambos',
    });
  });

  it('CAMBIO/ambos cuando el reperfilado del izquierdo lo dejaría en Seguimiento o peor', () => {
    // h=1.8 >= 1.6; rd=1.0 - 0.8 = 0.2 <= 0.4 -> el reperfilado no alcanza
    const izquierdo: MedicionDisco = { rd: 1.0, h: 1.8 };
    const derecho: MedicionDisco = { rd: 1.5, h: 1.0 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'CAMBIO',
      ladoAfectado: 'ambos',
    });
  });

  it('límite exacto: H == h_umbral_reperfilado (1.60) cuenta como "H suficiente"', () => {
    // h=1.6 exacto (>=) y rd - descuento = 1.5 - 0.8 = 0.7 > 0.4 -> viable
    const izquierdo: MedicionDisco = { rd: 1.5, h: 1.6 };
    const derecho: MedicionDisco = { rd: 1.5, h: 1.0 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'REPERFILADO',
      ladoAfectado: 'izquierdo',
    });
  });

  it('justo debajo de h_umbral_reperfilado no cuenta como "H suficiente"', () => {
    const izquierdo: MedicionDisco = { rd: 1.5, h: 1.599999 };
    const derecho: MedicionDisco = { rd: 1.5, h: 1.0 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'NINGUNA',
      ladoAfectado: null,
    });
  });

  it('límite exacto: rd - descuento == rd_umbral_seguimiento (0.40) es CAMBIO, no REPERFILADO', () => {
    // rd=1.2, descuento=0.8 -> 1.2 - 0.8 = 0.4 == rd_umbral_seguimiento
    const izquierdo: MedicionDisco = { rd: 1.2, h: 1.8 };
    const derecho: MedicionDisco = { rd: 1.5, h: 1.0 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'CAMBIO',
      ladoAfectado: 'ambos',
    });
  });

  it('justo por encima del límite (rd - descuento = 0.400001) ya es REPERFILADO', () => {
    const izquierdo: MedicionDisco = { rd: 1.200001, h: 1.8 };
    const derecho: MedicionDisco = { rd: 1.5, h: 1.0 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'REPERFILADO',
      ladoAfectado: 'izquierdo',
    });
  });

  it('la condición crítica (rd <= 0) tiene prioridad sobre cualquier reperfilado viable', () => {
    // El derecho sería "reperfilado viable" por sí solo, pero el izquierdo es crítico.
    const izquierdo: MedicionDisco = { rd: -0.5, h: 1.0 };
    const derecho: MedicionDisco = { rd: 1.5, h: 1.8 };

    expect(engine.evaluarAccionRecomendada(izquierdo, derecho)).toEqual({
      accion: 'CRITICO',
      ladoAfectado: 'ambos',
    });
  });
});
