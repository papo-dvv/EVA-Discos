import { LadoDisco } from '../../generated/prisma';
import { BrakeDiscRulesEngine } from '../brake-disc-rules/brake-disc-rules.engine';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import {
  procesarCsvMedicion,
  resolverIdentidadPorEje,
  resolverRuedaNumero,
} from './new-measurement-csv.parser';

const evaluador = new BrakeDiscRulesEngine(UMBRALES_POR_DEFECTO);

// Fixture "largo" de Nextsense/cpo: 3 líneas de metadata + encabezado de
// columnas + filas de datos. Incluye a propósito:
//  - un disco_freno con lado bien escrito (eje 1, izquierdo)
//  - un disco_freno con el typo real del enunciado ("izquiero", eje 13)
//  - un Rueda_N y un Punto_N (deben ignorarse por completo)
//  - una carga PARCIAL: solo 2 de los 48 discos posibles
function csvFixture(): string {
  return [
    'MeasPlan.Name;Plan de prueba',
    'ID_del_tren;32',
    'Kilometraje;125000',
    'MeasObject.Name;MeasPoint.Name;Dimension.Name;Dimension.Value;Dimension.Unit;Meas.Date;Meas.Time;ProfileLink',
    'Ma1;disco_freno_1_izquierdo;H;12.500;mm;20260115;093000;link1',
    'Ma1;disco_freno_1_izquierdo;T;14.000;mm;20260115;093000;link1',
    'Ma1;disco_freno_1_izquierdo;Rd;1.500;mm;20260115;093000;link1',
    'R;disco_freno_13_izquiero;H;10.000;mm;20260115;094000;link2',
    'R;disco_freno_13_izquiero;T;11.500;mm;20260115;094000;link2',
    'Ma1;Rueda_5;FlHeight;29.500;mm;20260115;095000;link3',
    'Ma1;Rueda_5;FlThickness;32.000;mm;20260115;095000;link3',
    'Ma1;Punto_3;Dp;850.000;mm;20260115;095500;link4',
  ].join('\r\n');
}

describe('resolverIdentidadPorEje', () => {
  it('mapea cada rango de eje global (1-24) al tipo de coche y bogie correctos', () => {
    expect(resolverIdentidadPorEje(1)).toEqual({
      tipoCoche: 'MA1',
      bogieCodigo: 'PB3',
    });
    expect(resolverIdentidadPorEje(4)).toEqual({
      tipoCoche: 'MA1',
      bogieCodigo: 'PB4',
    });
    expect(resolverIdentidadPorEje(5)).toEqual({
      tipoCoche: 'MB1',
      bogieCodigo: 'PB6',
    });
    expect(resolverIdentidadPorEje(8)).toEqual({
      tipoCoche: 'MB1',
      bogieCodigo: 'PB2',
    });
    expect(resolverIdentidadPorEje(13)).toEqual({
      tipoCoche: 'REM',
      bogieCodigo: 'TB1',
    });
    expect(resolverIdentidadPorEje(16)).toEqual({
      tipoCoche: 'REM',
      bogieCodigo: 'TB2',
    });
    expect(resolverIdentidadPorEje(21)).toEqual({
      tipoCoche: 'MA2',
      bogieCodigo: 'PB4',
    });
    expect(resolverIdentidadPorEje(24)).toEqual({
      tipoCoche: 'MA2',
      bogieCodigo: 'PB3',
    });
  });

  it('fuera de rango (0 o 25) devuelve null', () => {
    expect(resolverIdentidadPorEje(0)).toBeNull();
    expect(resolverIdentidadPorEje(25)).toBeNull();
  });
});

describe('resolverRuedaNumero', () => {
  it('impar (2N-1) para izquierdo, par (2N) para derecho', () => {
    expect(resolverRuedaNumero(1, LadoDisco.izquierdo)).toBe(1);
    expect(resolverRuedaNumero(1, LadoDisco.derecho)).toBe(2);
    expect(resolverRuedaNumero(24, LadoDisco.izquierdo)).toBe(47);
    expect(resolverRuedaNumero(24, LadoDisco.derecho)).toBe(48);
  });
});

describe('procesarCsvMedicion — metadata', () => {
  it('extrae MeasPlan.Name, ID_del_tren y Kilometraje de las 3 líneas iniciales', () => {
    const resultado = procesarCsvMedicion(csvFixture(), evaluador);
    expect(resultado.metadata.measPlanName).toBe('Plan de prueba');
    expect(resultado.metadata.trenNumero).toBe(32);
    expect(resultado.metadata.kilometraje).toBe(125000);
  });
});

describe('procesarCsvMedicion — filtro Rueda_N / Punto_N', () => {
  it('NO genera filas ni filas inválidas para Rueda_N ni Punto_N (fuera de alcance, no error)', () => {
    const resultado = procesarCsvMedicion(csvFixture(), evaluador);
    const measPoints = resultado.filas.map((f) => f.measPointNameOriginal);
    expect(measPoints.some((m) => m.startsWith('Rueda_'))).toBe(false);
    expect(measPoints.some((m) => m.startsWith('Punto_'))).toBe(false);
    const invalidos = resultado.filasInvalidas.map((f) => f.measPointName);
    expect(invalidos.some((m) => m.startsWith('Rueda_'))).toBe(false);
    expect(invalidos.some((m) => m.startsWith('Punto_'))).toBe(false);
  });
});

describe('procesarCsvMedicion — typo de lado ("izquiero")', () => {
  it('"disco_freno_13_izquiero" se resuelve a lado izquierdo por matching de substring', () => {
    const resultado = procesarCsvMedicion(csvFixture(), evaluador);
    const fila13 = resultado.filas.find((f) => f.ejeNumero === 13);
    expect(fila13).toBeDefined();
    expect(fila13!.lado).toBe(LadoDisco.izquierdo);
    expect(fila13!.tipoCoche).toBe('REM');
    expect(fila13!.bogieCodigo).toBe('TB1');
  });
});

describe('procesarCsvMedicion — carga parcial', () => {
  it('acepta una carga con solo 2 de 48 discos posibles, sin reportar error alguno', () => {
    const resultado = procesarCsvMedicion(csvFixture(), evaluador);
    expect(resultado.filas).toHaveLength(2);
    expect(resultado.filasInvalidas).toHaveLength(0);
  });
});

describe('procesarCsvMedicion — Rd recalculado y discrepancia', () => {
  it('rdValue siempre es T-H recalculado por el backend', () => {
    const resultado = procesarCsvMedicion(csvFixture(), evaluador);
    const fila1 = resultado.filas.find((f) => f.ejeNumero === 1)!;
    expect(fila1.tValue).toBe(14);
    expect(fila1.hValue).toBe(12.5);
    expect(fila1.rdValue).toBeCloseTo(1.5);
  });

  it('sin discrepancia cuando el Rd del CSV coincide con T-H (dentro de tolerancia)', () => {
    const resultado = procesarCsvMedicion(csvFixture(), evaluador);
    expect(resultado.discrepanciasRd).toHaveLength(0);
  });

  it('reporta discrepancia cuando el Rd del CSV difiere del recalculado más allá de la tolerancia', () => {
    const csvConDiscrepancia = [
      'MeasPlan.Name;Plan de prueba',
      'ID_del_tren;32',
      'Kilometraje;125000',
      'MeasObject.Name;MeasPoint.Name;Dimension.Name;Dimension.Value;Dimension.Unit;Meas.Date;Meas.Time;ProfileLink',
      'Ma1;disco_freno_1_izquierdo;H;12.500;mm;20260115;093000;link1',
      'Ma1;disco_freno_1_izquierdo;T;14.000;mm;20260115;093000;link1',
      'Ma1;disco_freno_1_izquierdo;Rd;9.000;mm;20260115;093000;link1',
    ].join('\r\n');
    const resultado = procesarCsvMedicion(csvConDiscrepancia, evaluador);
    expect(resultado.discrepanciasRd).toHaveLength(1);
    expect(resultado.discrepanciasRd[0].rdCsv).toBe(9);
    expect(resultado.discrepanciasRd[0].rdCalculado).toBeCloseTo(1.5);
  });
});

describe('procesarCsvMedicion — filas inválidas por falta de H o T', () => {
  it('un disco con solo H (sin T) se reporta como inválido, no se inserta', () => {
    const csvIncompleto = [
      'MeasPlan.Name;Plan de prueba',
      'ID_del_tren;32',
      'Kilometraje;125000',
      'MeasObject.Name;MeasPoint.Name;Dimension.Name;Dimension.Value;Dimension.Unit;Meas.Date;Meas.Time;ProfileLink',
      'Ma1;disco_freno_2_derecho;H;12.500;mm;20260115;093000;link1',
    ].join('\r\n');
    const resultado = procesarCsvMedicion(csvIncompleto, evaluador);
    expect(resultado.filas).toHaveLength(0);
    expect(resultado.filasInvalidas).toHaveLength(1);
    expect(resultado.filasInvalidas[0].motivo).toContain('T');
  });
});

describe('procesarCsvMedicion — sin fila de encabezado de columnas', () => {
  it('funciona igual si el CSV no trae la fila de encabezado (datos justo después de la metadata)', () => {
    const csvSinHeader = [
      'MeasPlan.Name;Plan de prueba',
      'ID_del_tren;32',
      'Kilometraje;125000',
      'Ma1;disco_freno_1_izquierdo;H;12.500;mm;20260115;093000;link1',
      'Ma1;disco_freno_1_izquierdo;T;14.000;mm;20260115;093000;link1',
    ].join('\r\n');
    const resultado = procesarCsvMedicion(csvSinHeader, evaluador);
    expect(resultado.filas).toHaveLength(1);
  });
});
