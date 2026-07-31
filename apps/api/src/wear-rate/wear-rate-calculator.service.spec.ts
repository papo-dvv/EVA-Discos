import {
  formatearTasa,
  WearRateCalculatorService,
} from './wear-rate-calculator.service';

const calculadora = new WearRateCalculatorService();

describe('calcularPar', () => {
  it('caso de referencia: Rd2 > Rd1 -> tasa 0, motivo correcto', () => {
    const resultado = calculadora.calcularPar({
      rd1: 5.0,
      rd2: 5.8,
      km1: 100_000,
      km2: 105_000,
      motivo2: 'Medición',
      kmMensual: 11_300,
    });

    expect(resultado.esValido).toBe(false);
    expect(resultado.tasa).toBe(0);
    expect(resultado.tasaMensual).toBe(0);
    expect(resultado.comentario).toBe('Rd de fecha 2 mayor que Rd de fecha 1');
  });

  it('motivo de fecha 2 es Reperfilado -> tasa 0', () => {
    const resultado = calculadora.calcularPar({
      rd1: 8.0,
      rd2: 7.2,
      km1: 100_000,
      km2: 105_000,
      motivo2: 'Reperfilado',
      kmMensual: 11_300,
    });

    expect(resultado.esValido).toBe(false);
    expect(resultado.tasa).toBe(0);
    expect(resultado.comentario).toBe('Motivo de fecha 2 es Reperfilado');
  });

  it('el par SIGUIENTE del mismo disco, con motivo Medición, se calcula normal (no hereda invalidez)', () => {
    // Simula la cadena: par 1 (Reperfilado, inválido) -> par 2 (Medición, válido).
    const par1 = calculadora.calcularPar({
      rd1: 8.0,
      rd2: 7.2,
      km1: 100_000,
      km2: 105_000,
      motivo2: 'Reperfilado',
      kmMensual: 11_300,
    });
    expect(par1.esValido).toBe(false);

    const par2 = calculadora.calcularPar({
      // fecha2 del par1 pasa a ser fecha1 del par2.
      rd1: 7.2,
      rd2: 6.8,
      km1: 105_000,
      km2: 110_000,
      motivo2: 'Medición',
      kmMensual: 11_300,
    });

    expect(par2.esValido).toBe(true);
    expect(par2.comentario).toBe('Válido');
    expect(par2.diferenciaRd).toBeCloseTo(0.4);
    expect(par2.diferenciaKm).toBe(5_000);
    expect(par2.tasa).toBeCloseTo(0.4 / 5_000);
    expect(par2.tasaMensual).toBeCloseTo((0.4 / 5_000) * 11_300);
  });

  it('motivo de fecha 2 es Cambio -> tasa 0', () => {
    const resultado = calculadora.calcularPar({
      rd1: 3.0,
      rd2: 2.5,
      km1: 100_000,
      km2: 102_000,
      motivo2: 'Cambio',
      kmMensual: 11_300,
    });

    expect(resultado.esValido).toBe(false);
    expect(resultado.comentario).toBe('Motivo de fecha 2 es Cambio');
  });

  // Caso real (tren 11, coche 121, PB3 eje1): motivo2='Cambio par montado',
  // diferenciaKm=1, rd1=6.92, rd2≈1.00 -> con igualdad exacta ('Cambio' !==
  // 'Cambio par montado') este par quedaba esValido=true y su caída de Rd
  // real (por el cambio de disco, no desgaste) se extrapolaba a un mes
  // completo -> tasaMensual≈66,896, el outlier que inflaba los límites de
  // Gauss a rangos de miles. Cubre todas las variantes reales encontradas en
  // el diagnóstico (case-insensitive, cualquier posición del texto).
  it.each([
    'Cambio par montado',
    'Cambio Par Montado',
    'cambio par montado',
    'Cambio de discos',
    'Cambio de Disco',
    'Cambio de disco',
    'Cambio de pares montados',
    'Cambio de par montado',
    'Cambio pares montados',
    'Medición y Cambio',
  ])(
    'motivo de fecha 2 = "%s" (variante real de cambio) -> tasa 0',
    (motivo2) => {
      const resultado = calculadora.calcularPar({
        rd1: 6.92,
        rd2: 1.0,
        km1: 1_644_094,
        km2: 1_644_095,
        motivo2,
        kmMensual: 11_300,
      });

      expect(resultado.esValido).toBe(false);
      expect(resultado.tasa).toBe(0);
      expect(resultado.tasaMensual).toBe(0);
      expect(resultado.comentario).toBe('Motivo de fecha 2 es Cambio');
    },
  );

  // Caso real (tren 10, coche 120, PB4/PB3): motivo2='Pares montados de
  // giro', diferenciaKm=207 idéntico en 6 pares con tasaMensual de 32 a 43 —
  // el grupo que más ensanchaba los límites de Gauss una vez excluida la
  // familia "Cambio" (ver diagnóstico). Case-insensitive por el mismo motivo
  // que MOTIVO_CAMBIO.
  it.each([
    'Pares montados de giro',
    'PARES MONTADOS DE GIRO',
    'pares montados de giro',
  ])('motivo de fecha 2 = "%s" -> tasa 0', (motivo2) => {
    const resultado = calculadora.calcularPar({
      rd1: 6.94,
      rd2: 6.15,
      km1: 1_530_658,
      km2: 1_530_865,
      motivo2,
      kmMensual: 11_300,
    });

    expect(resultado.esValido).toBe(false);
    expect(resultado.tasa).toBe(0);
    expect(resultado.tasaMensual).toBe(0);
    expect(resultado.comentario).toBe(
      'Motivo de fecha 2 es Pares montados de giro',
    );
  });

  it('motivo de fecha 2 que NO menciona cambio sigue calculando normal (no falso positivo)', () => {
    const resultado = calculadora.calcularPar({
      rd1: 10.0,
      rd2: 9.5,
      km1: 100_000,
      km2: 110_000,
      motivo2: 'Medición',
      kmMensual: 11_300,
    });

    expect(resultado.esValido).toBe(true);
  });

  it('kilometraje de fecha 2 menor que fecha 1 -> tasa 0', () => {
    const resultado = calculadora.calcularPar({
      rd1: 5.0,
      rd2: 4.5,
      km1: 100_000,
      km2: 99_000,
      motivo2: 'Medición',
      kmMensual: 11_300,
    });

    expect(resultado.esValido).toBe(false);
    expect(resultado.comentario).toBe(
      'Kilometraje de fecha 2 menor que fecha 1',
    );
  });

  it('kilometraje de fecha 2 IGUAL a fecha 1 -> tasa 0 (evita división por cero)', () => {
    const resultado = calculadora.calcularPar({
      rd1: 5.0,
      rd2: 4.8,
      km1: 100_000,
      km2: 100_000,
      motivo2: 'Medición',
      kmMensual: 11_300,
    });

    expect(resultado.esValido).toBe(false);
    expect(Number.isFinite(resultado.tasa)).toBe(true);
    expect(resultado.tasa).toBe(0);
    expect(resultado.comentario).toBe(
      'Kilometraje de fecha 2 igual a fecha 1 (no se puede calcular una tasa)',
    );
  });

  it('acumula TODOS los motivos que aplican, unidos con "; "', () => {
    const resultado = calculadora.calcularPar({
      rd1: 5.0,
      rd2: 6.0, // Rd2 > Rd1
      km1: 100_000,
      km2: 99_000, // Km2 < Km1
      motivo2: 'Cambio',
      kmMensual: 11_300,
    });

    expect(resultado.esValido).toBe(false);
    expect(resultado.comentario).toBe(
      'Rd de fecha 2 mayor que Rd de fecha 1; Motivo de fecha 2 es Cambio; Kilometraje de fecha 2 menor que fecha 1',
    );
  });

  it('par normal válido: calcula tasa y tasa mensual', () => {
    const resultado = calculadora.calcularPar({
      rd1: 10.0,
      rd2: 9.5,
      km1: 100_000,
      km2: 110_000,
      motivo2: 'Medición',
      kmMensual: 11_300,
    });

    expect(resultado.esValido).toBe(true);
    expect(resultado.comentario).toBe('Válido');
    expect(resultado.diferenciaRd).toBeCloseTo(0.5);
    expect(resultado.diferenciaKm).toBe(10_000);
    expect(resultado.tasa).toBeCloseTo(0.5 / 10_000);
    expect(resultado.tasaMensual).toBeCloseTo((0.5 / 10_000) * 11_300);
  });
});

describe('formatearTasa', () => {
  it('redondea a 7 decimales por defecto', () => {
    expect(formatearTasa(0.00012345678)).toBe('0.0001235');
  });

  it('da "0.0000000" para tasa exactamente cero', () => {
    expect(formatearTasa(0)).toBe('0.0000000');
  });

  it('tasa muy pequeña: extiende hasta 9 decimales si 7 dan todo ceros', () => {
    // 0.4 decimales de Rd sobre 9_000_000 km -> a 7 decimales redondea a
    // "0.0000000"; el primer dígito significativo aparece recién en el 8vo.
    const valor = 0.4 / 9_000_000;
    expect(valor.toFixed(7)).toBe('0.0000000');
    const formateado = formatearTasa(valor);
    expect(formateado).toBe(valor.toFixed(8));
    expect(Number(formateado)).not.toBe(0);
  });

  it('tope máximo de 9 decimales aunque el valor real sea aún más pequeño', () => {
    const valor = 0.4 / 900_000_000; // ~4.4e-10, ni con 9 decimales alcanza
    expect(formatearTasa(valor)).toBe(valor.toFixed(9));
  });
});
