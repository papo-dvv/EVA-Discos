import { utils } from 'xlsx';
import { BrakeDiscRulesEngine } from '../brake-disc-rules/brake-disc-rules.engine';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import { construirWorkbookPrueba } from './__fixtures__/construir-workbook-prueba';
import {
  HOJAS_MIGRACION,
  normalizarCoche,
  procesarWorkbook,
  resolverLado,
} from './migration-excel.parser';

const evaluador = new BrakeDiscRulesEngine(UMBRALES_POR_DEFECTO);

describe('resolverLado', () => {
  it('formato real de la flota: "disco_freno_N_derecho"/"..._izquierdo" (lado como SUFIJO)', () => {
    // Caso real que descubrió el bug: con startsWith() esto nunca matcheaba
    // (el texto no EMPIEZA con "der"/"izq") y caía siempre al fallback de
    // paridad de rueda — ver Tren 32 / coche 208 / bogie PB4 / eje 22.
    expect(resolverLado('disco_freno_22_derecho', 44)).toBe('derecho');
    expect(resolverLado('disco_freno_22_izquierdo', 43)).toBe('izquierdo');
    // Con la paridad "al revés" de la que daría el fallback, para probar que
    // realmente está leyendo el texto y no cayendo al fallback por azar.
    expect(resolverLado('disco_freno_5_derecho', 5)).toBe('derecho');
    expect(resolverLado('disco_freno_8_izquierdo', 8)).toBe('izquierdo');
  });

  it('formas cortas exactas (i/d/left/right) siguen reconociéndose', () => {
    expect(resolverLado('i', null)).toBe('izquierdo');
    expect(resolverLado('d', null)).toBe('derecho');
    expect(resolverLado('left', null)).toBe('izquierdo');
    expect(resolverLado('right', null)).toBe('derecho');
  });

  it('mayúsculas y espacios no afectan el match', () => {
    expect(resolverLado('  DISCO_FRENO_1_DERECHO  ', null)).toBe('derecho');
    expect(resolverLado('Izquierdo', null)).toBe('izquierdo');
  });

  it('sin texto reconocible -> cae al fallback de paridad de rueda (impar=izq, par=der)', () => {
    expect(resolverLado('sin-dato', 43)).toBe('izquierdo');
    expect(resolverLado('sin-dato', 44)).toBe('derecho');
    expect(resolverLado(null, 7)).toBe('izquierdo');
  });

  it('sin texto reconocible NI rueda -> null', () => {
    expect(resolverLado(null, null)).toBeNull();
    expect(resolverLado('sin-dato', null)).toBeNull();
  });
});

describe('procesarWorkbook — fixture T06/T07', () => {
  const resultado = procesarWorkbook(construirWorkbookPrueba(), evaluador);

  it('procesa solo las hojas del rango T06–T44 presentes (ignora Resumen y T05)', () => {
    expect(resultado.hojasProcesadas).toEqual(['T06', 'T07']);
  });

  it('reporta como faltantes las 37 hojas del rango que no están (T08–T44)', () => {
    expect(resultado.hojasFaltantes).toHaveLength(37);
    expect(resultado.hojasFaltantes).toContain('T08');
    expect(resultado.hojasFaltantes).toContain('T44');
    expect(resultado.hojasFaltantes).not.toContain('T06');
    expect(resultado.hojasFaltantes).not.toContain('T07');
    // El rango completo es de 39 hojas.
    expect(HOJAS_MIGRACION).toHaveLength(39);
  });

  it('lee 8 filas de datos (6 de T06 + 2 de T07)', () => {
    expect(resultado.filas).toHaveLength(8);
  });

  it('cubre los 5 estados calculados por el backend (incluido REPERFILADO)', () => {
    const estados = resultado.filas.map((f) => f.estadoCalculado);
    expect(estados).toContain('OK');
    expect(estados).toContain('SEGUIMIENTO');
    expect(estados).toContain('CAMBIO');
    expect(estados).toContain('CRITICO');
    expect(estados).toContain('REPERFILADO');
  });

  it('calcula rd = T - H y NUNCA usa la columna T-H de la planilla (que trae 999)', () => {
    const primera = resultado.filas[0];
    expect(primera.tValue).toBe(12.4);
    expect(primera.hValue).toBe(3.8);
    expect(primera.rdValue).toBeCloseTo(8.6);
    // REPERFILADO, no OK: h=3.8 >= 1.6 y (8.6-0.8)=7.8 > 0.4 -> H manda (ver
    // clasificarEstadoConReperfilado).
    expect(primera.estadoCalculado).toBe('REPERFILADO');
  });

  it('corrige el tren según la hoja y conserva el valor original (99 -> 6 en T06)', () => {
    const corregida = resultado.filas.find((f) => f.trenOriginalExcel === 99);
    expect(corregida).toBeDefined();
    expect(corregida!.trenNumero).toBe(6);
    expect(corregida!.corregidoPorHoja).toBe(true);
    expect(corregida!.hojaExcelOrigen).toBe('T06');
  });

  it('corrige el tren también en T07 (6 -> 7)', () => {
    const filasT07 = resultado.filas.filter((f) => f.hojaExcelOrigen === 'T07');
    const corregida = filasT07.find((f) => f.corregidoPorHoja);
    expect(corregida).toBeDefined();
    expect(corregida!.trenNumero).toBe(7);
    expect(corregida!.trenOriginalExcel).toBe(6);
  });

  it('no marca corrección cuando el tren de la fila coincide con la hoja', () => {
    const sinCorreccion = resultado.filas.filter((f) => !f.corregidoPorHoja);
    expect(sinCorreccion.every((f) => f.trenOriginalExcel === null)).toBe(true);
  });

  it('marca discrepancia de estado cuando el backend calcula OK pero la planilla dice "Cambio"', () => {
    const discrepante = resultado.filas.find((f) => f.discrepanciaEstadoExcel);
    expect(discrepante).toBeDefined();
    expect(discrepante!.estadoCalculado).toBe('OK');
    expect(discrepante!.estadoSugeridoExcel).toBe('Cambio');
  });

  it('cuenta 3 advertencias (2 correcciones de tren + 1 discrepancia de estado)', () => {
    const conAdvertencia = resultado.filas.filter(
      (f) => f.corregidoPorHoja || f.discrepanciaEstadoExcel,
    );
    expect(conAdvertencia).toHaveLength(3);
  });

  it('detalleDiscrepancias incluye tanto correcciones de tren como discrepancias de estado', () => {
    const tipos = resultado.detalleDiscrepancias.map((d) => d.tipo);
    expect(tipos.filter((t) => t === 'tren')).toHaveLength(2);
    expect(tipos.filter((t) => t === 'estado')).toHaveLength(1);
  });

  it('conserva la identidad cruda del disco para resolver disc_id al confirmar', () => {
    const primera = resultado.filas[0];
    expect(primera.cocheExcel).toBe('MA1');
    expect(primera.numeroCocheExcel).toBe(129);
    expect(primera.bogieExcel).toBe('PB2');
    expect(primera.ejeExcel).toBe(1);
    expect(primera.ubicacionExcel).toBe('izquierdo');
    expect(primera.ruedaExcel).toBe(1);
  });

  it('lee correctamente el resto de columnas fuente (responsable, kilometraje, motivo, fecha)', () => {
    const primera = resultado.filas[0];
    expect(primera.responsableNombre).toBe('Juan Pérez');
    expect(primera.kilometraje).toBe(125000.5);
    expect(primera.motivo).toBe('Medición');
    expect(primera.fecha).toBeInstanceOf(Date);
  });
});

describe('procesarWorkbook — casos aislados', () => {
  // Helper: arma un workbook de una sola hoja a partir de AoA (fila 1 panel,
  // fila 2 encabezados, resto datos).
  function workbookDeUnaHoja(nombre: string, filas: unknown[][]) {
    const wb = utils.book_new();
    utils.book_append_sheet(wb, utils.aoa_to_sheet(filas), nombre);
    return wb;
  }

  const ENCABEZADOS_BASE = [
    'Responsable',
    'Tren',
    'Kilometraje',
    'Fecha',
    'Motivo',
    'Coche',
    'N° Coche',
    'Bogie',
    'Eje',
    'Ubicación',
    'Rueda',
    'H',
    'T',
    'T-H',
    'Comentario',
  ];

  it('reporta las 38 hojas faltantes cuando solo está T06', () => {
    const wb = workbookDeUnaHoja('T06', [
      ['Panel Principal'],
      ENCABEZADOS_BASE,
      [
        'R',
        6,
        100,
        '2024-01-01',
        'Medición',
        'MA1',
        129,
        'PB2',
        1,
        'izquierdo',
        1,
        3.8,
        12.4,
        0,
        'OK',
      ],
    ]);

    const res = procesarWorkbook(wb, evaluador);
    expect(res.hojasProcesadas).toEqual(['T06']);
    expect(res.hojasFaltantes).toHaveLength(38);
    expect(res.filas).toHaveLength(1);
  });

  it('mapea las columnas por nombre, no por posición (resiste orden distinto)', () => {
    // Encabezados en orden invertido respecto al base.
    const encabezadosDesordenados = [...ENCABEZADOS_BASE].reverse();
    // Fila en el mismo orden invertido: Comentario, T-H, T, H, Rueda, ...
    // Comentario='OK', T-H=0, T=12.4, H=3.8, Rueda=1, Ubicación='derecho',
    // Eje=2, Bogie='PB3', N°Coche=130, Coche='MB1', Motivo='Medición',
    // Fecha, Kilometraje=200, Tren=6, Responsable='Zoe'
    const filaInvertida = [
      'OK',
      0,
      12.4,
      3.8,
      1,
      'derecho',
      2,
      'PB3',
      130,
      'MB1',
      'Medición',
      '2024-03-03',
      200,
      6,
      'Zoe',
    ];
    const wb = workbookDeUnaHoja('T06', [
      ['Panel Principal'],
      encabezadosDesordenados,
      filaInvertida,
    ]);

    const res = procesarWorkbook(wb, evaluador);
    const fila = res.filas[0];
    expect(fila.responsableNombre).toBe('Zoe');
    expect(fila.tValue).toBe(12.4);
    expect(fila.hValue).toBe(3.8);
    expect(fila.bogieExcel).toBe('PB3');
    expect(fila.ubicacionExcel).toBe('derecho');
    // REPERFILADO, no OK: h=3.8 >= 1.6 y (8.6-0.8)=7.8 > 0.4 -> H manda.
    expect(fila.estadoCalculado).toBe('REPERFILADO');
  });

  it('una hoja del rango presente pero sin filas de datos se procesa sin filas', () => {
    const wb = workbookDeUnaHoja('T06', [
      ['Panel Principal'],
      ENCABEZADOS_BASE,
    ]);
    const res = procesarWorkbook(wb, evaluador);
    expect(res.hojasProcesadas).toEqual(['T06']);
    expect(res.filas).toHaveLength(0);
  });

  it('no marca discrepancia de estado si "Comentario" no es un estado reconocido (ej. "Reperfilado")', () => {
    const wb = workbookDeUnaHoja('T06', [
      ['Panel Principal'],
      ENCABEZADOS_BASE,
      [
        'R',
        6,
        100,
        '2024-01-01',
        'Reperfilado',
        'MA1',
        129,
        'PB2',
        1,
        'izquierdo',
        1,
        3.8,
        12.4,
        0,
        'Reperfilado',
      ],
    ]);
    const res = procesarWorkbook(wb, evaluador);
    expect(res.filas[0].discrepanciaEstadoExcel).toBe(false);
    // Igual se conserva el texto original de la planilla como referencia.
    expect(res.filas[0].estadoSugeridoExcel).toBe('Reperfilado');
  });

  it('empareja "Crítico" (con acento) contra el estado CRITICO sin marcar discrepancia', () => {
    const wb = workbookDeUnaHoja('T06', [
      ['Panel Principal'],
      ENCABEZADOS_BASE,
      [
        'R',
        6,
        100,
        '2024-01-01',
        'Medición',
        'MA1',
        129,
        'PB2',
        1,
        'izquierdo',
        1,
        7.9,
        3.0,
        0,
        'Crítico',
      ],
    ]);
    const res = procesarWorkbook(wb, evaluador);
    expect(res.filas[0].estadoCalculado).toBe('CRITICO');
    expect(res.filas[0].discrepanciaEstadoExcel).toBe(false);
  });

  // Helper: una fila de datos completa y válida.
  function filaValida(overrides: Record<number, unknown> = {}): unknown[] {
    const base = [
      'Ana',
      6,
      100,
      '2024-01-01',
      'Medición',
      'MA1',
      129,
      'PB2',
      1,
      'izquierdo',
      1,
      3.8,
      12.4,
      0,
      'OK',
    ];
    for (const [idx, val] of Object.entries(overrides)) base[Number(idx)] = val;
    return base;
  }

  it('descarta las filas fantasma del final del rango (formato heredado sin datos), sin lanzar 500', () => {
    // Datos reales en las filas 3-10 (8 filas) y luego 5 filas fantasma hasta la
    // fila 15: sin datos en los campos identificadores (Fecha/Coche/Bogie/Eje/H/T),
    // solo un valor suelto en una columna no identificadora (Kilometraje) que
    // simula el rango con formato heredado que arrastra Excel.
    const IDX_KM = 2;
    const filaFantasma = () => {
      const f = Array<unknown>(ENCABEZADOS_BASE.length).fill(null);
      f[IDX_KM] = 0; // valor suelto/heredado en columna NO identificadora
      return f;
    };
    const filasDatos = Array.from({ length: 8 }, (_, i) =>
      filaValida({ 6: 129 + i }),
    );
    const wb = workbookDeUnaHoja('T06', [
      ['Panel Principal'],
      ENCABEZADOS_BASE,
      ...filasDatos,
      ...Array.from({ length: 5 }, filaFantasma),
    ]);

    let res!: ReturnType<typeof procesarWorkbook>;
    expect(() => {
      res = procesarWorkbook(wb, evaluador);
    }).not.toThrow();

    expect(res.filas).toHaveLength(8); // solo las filas 3-10 reales
    expect(res.filasVaciasOmitidas).toBe(5); // las 5 fantasma, descartadas
    expect(res.filasInvalidas).toHaveLength(0);
    expect(res.totalFilasLeidas).toBe(13);
    // Ninguna fila insertable quedó con estado falso ni fecha inválida.
    expect(res.filas.every((f) => f.fecha instanceof Date)).toBe(true);
    expect(res.filas.some((f) => f.estadoCalculado === 'CRITICO')).toBe(false);
  });

  it('marca inválida (sin insertar) una fila con datos pero sin H o T', () => {
    const wb = workbookDeUnaHoja('T06', [
      ['Panel Principal'],
      ENCABEZADOS_BASE,
      filaValida({ 11: null, 12: null }), // H y T vacíos, resto con datos
    ]);
    const res = procesarWorkbook(wb, evaluador);
    expect(res.filas).toHaveLength(0);
    expect(res.filasInvalidas).toEqual([
      { hoja: 'T06', fila: 3, motivo: 'Falta H o T' },
    ]);
  });

  it('marca inválida (sin insertar) una fila con fecha inválida', () => {
    const wb = workbookDeUnaHoja('T06', [
      ['Panel Principal'],
      ENCABEZADOS_BASE,
      filaValida({ 3: 'no-es-fecha' }),
    ]);
    const res = procesarWorkbook(wb, evaluador);
    expect(res.filas).toHaveLength(0);
    expect(res.filasInvalidas).toEqual([
      { hoja: 'T06', fila: 3, motivo: 'Fecha inválida o ausente' },
    ]);
  });

  it('NO convierte un H/T ausente en 0 (evita el falso Crítico del bug)', () => {
    const wb = workbookDeUnaHoja('T06', [
      ['Panel Principal'],
      ENCABEZADOS_BASE,
      filaValida({ 12: null }), // solo falta T
    ]);
    const res = procesarWorkbook(wb, evaluador);
    // No se inserta como CRITICO con rd=0; se reporta como inválida.
    expect(res.filas).toHaveLength(0);
    expect(res.filasInvalidas[0].motivo).toBe('Falta H o T');
  });

  // --- Detección de la fila de encabezado por contenido (bug de desfase) ---

  it('detecta el encabezado en la FILA 1 cuando NO hay fila "Panel Principal" (formato del archivo real)', () => {
    const wb = workbookDeUnaHoja('T06', [
      ENCABEZADOS_BASE, // fila 1 = encabezados (sin panel)
      filaValida(), // fila 2 = datos
      filaValida({ 6: 130 }), // fila 3 = datos
    ]);
    const res = procesarWorkbook(wb, evaluador);
    expect(res.hojasConError).toHaveLength(0);
    expect(res.filas).toHaveLength(2);
    expect(res.filasVaciasOmitidas).toBe(0);
    expect(res.filas[0].cocheExcel).toBe('MA1');
    expect(res.filas[0].bogieExcel).toBe('PB2');
    expect(res.filas[0].hValue).toBe(3.8);
  });

  it('detecta el encabezado en la FILA 2 cuando hay fila "Panel Principal" (formato fixture)', () => {
    const wb = workbookDeUnaHoja('T06', [
      ['Panel Principal'], // fila 1 = panel
      ENCABEZADOS_BASE, // fila 2 = encabezados
      filaValida(), // fila 3 = datos
    ]);
    const res = procesarWorkbook(wb, evaluador);
    expect(res.hojasConError).toHaveLength(0);
    expect(res.filas).toHaveLength(1);
    expect(res.filasVaciasOmitidas).toBe(0);
    expect(res.filas[0].cocheExcel).toBe('MA1');
  });

  it('marca la hoja con error (sin omitir filas como vacías) si no hay encabezado identificable', () => {
    // Ninguna de las primeras filas trae las etiquetas obligatorias.
    const wb = workbookDeUnaHoja('T06', [
      filaValida(),
      filaValida({ 6: 130 }),
      filaValida({ 6: 131 }),
    ]);
    const res = procesarWorkbook(wb, evaluador);
    expect(res.filas).toHaveLength(0);
    expect(res.filasVaciasOmitidas).toBe(0); // NO se cuentan como vacías
    expect(res.hojasConError).toHaveLength(1);
    expect(res.hojasConError[0].hoja).toBe('T06');
    expect(res.hojasConError[0].motivo).toContain('encabezado');
  });

  // --- Normalización y validación de "Coche" (bug: commit fallaba con "R"
  // y el filtro mostraba "MA1"/"Ma1" como valores distintos) ---

  describe('normalizarCoche', () => {
    it('mapea variantes abreviadas de Remolque ("r", "R.") a "REM"', () => {
      expect(normalizarCoche('r')).toBe('REM');
      expect(normalizarCoche('R.')).toBe('REM');
      expect(normalizarCoche('REM')).toBe('REM');
      expect(normalizarCoche(' REM ')).toBe('REM');
    });

    it('normaliza a mayúsculas sin alterar tipos ya válidos ("ma1" -> "MA1")', () => {
      expect(normalizarCoche('ma1')).toBe('MA1');
      expect(normalizarCoche(' Mb2 ')).toBe('MB2');
    });

    it('devuelve null para valores vacíos o ausentes', () => {
      expect(normalizarCoche(null)).toBeNull();
      expect(normalizarCoche('   ')).toBeNull();
    });
  });

  describe('Coche en el parser (procesarWorkbook)', () => {
    it('normaliza "r" a "REM" en cocheExcel (antes: commit fallaba con "hoja T09, tipo de coche inválido (R)")', () => {
      const wb = workbookDeUnaHoja('T09', [
        ['Panel Principal'],
        ENCABEZADOS_BASE,
        filaValida({ 5: 'r' }),
      ]);
      const res = procesarWorkbook(wb, evaluador);
      expect(res.filasInvalidas).toHaveLength(0);
      expect(res.filas).toHaveLength(1);
      expect(res.filas[0].cocheExcel).toBe('REM');
    });

    it('normaliza "Ma1" y "MA1" al MISMO valor (antes: el filtro mostraba ambos como distintos)', () => {
      const wb = workbookDeUnaHoja('T06', [
        ['Panel Principal'],
        ENCABEZADOS_BASE,
        filaValida({ 5: 'Ma1', 6: 129 }),
        filaValida({ 5: 'MA1', 6: 130 }),
      ]);
      const res = procesarWorkbook(wb, evaluador);
      expect(res.filas).toHaveLength(2);
      expect(new Set(res.filas.map((f) => f.cocheExcel))).toEqual(
        new Set(['MA1']),
      );
    });

    it('marca inválida (sin insertar) una fila con tipo de coche que no matchea el enum, SIN abortar el resto de la hoja', () => {
      const wb = workbookDeUnaHoja('T09', [
        ['Panel Principal'],
        ENCABEZADOS_BASE,
        filaValida({ 5: 'XYZ', 6: 129 }), // inválido tras normalizar
        filaValida({ 5: 'MA1', 6: 130 }), // válida: debe seguir procesándose
      ]);
      const res = procesarWorkbook(wb, evaluador);
      expect(res.filas).toHaveLength(1);
      expect(res.filas[0].numeroCocheExcel).toBe(130);
      expect(res.filasInvalidas).toEqual([
        { hoja: 'T09', fila: 3, motivo: 'Tipo de coche inválido (XYZ)' },
      ]);
    });

    it('marca inválida una fila sin valor de Coche', () => {
      const wb = workbookDeUnaHoja('T06', [
        ['Panel Principal'],
        ENCABEZADOS_BASE,
        filaValida({ 5: null }),
      ]);
      const res = procesarWorkbook(wb, evaluador);
      expect(res.filas).toHaveLength(0);
      expect(res.filasInvalidas).toEqual([
        { hoja: 'T06', fila: 3, motivo: 'Tipo de coche inválido (vacío)' },
      ]);
    });
  });
});
