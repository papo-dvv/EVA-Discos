import {
  fechaCaeEnMes,
  generarMesesForecast,
  interpolarEnFecha,
  mesesEntre,
  proyectarCiclos,
  ProyeccionNoConvergeError,
  sumarMeses,
  type UmbralesProyeccion,
} from './proyeccion-calculator.engine';

const UMBRALES_POR_DEFECTO: UmbralesProyeccion = {
  hUmbralReperfilado: 1.6,
  reperfiladoDescuentoRd: 0.8,
  rdUmbralSeguimiento: 0.4,
  rdUmbralCambioProyeccion: 0.4,
};

describe('sumarMeses / mesesEntre', () => {
  it('convierte meses decimales en días de 30 días y conserva el round-trip', () => {
    const fecha = new Date('2026-01-01T00:00:00.000Z');
    const destino = sumarMeses(fecha, 5.6);
    const esperado = new Date(fecha.getTime() + 5.6 * 30 * 24 * 60 * 60 * 1000);

    expect(destino.getTime()).toBe(esperado.getTime());
    expect(mesesEntre(fecha, destino)).toBeCloseTo(5.6, 6);
  });

  it('trunca los meses a un decimal antes de convertirlos a días', () => {
    const fecha = new Date('2026-01-01T00:00:00.000Z');
    const destino = sumarMeses(fecha, 5.678);
    const esperado = new Date(fecha.getTime() + 5.6 * 30 * 24 * 60 * 60 * 1000);

    expect(destino.getTime()).toBe(esperado.getTime());
  });

  it('0 meses no mueve la fecha', () => {
    const fecha = new Date('2026-01-01T00:00:00.000Z');
    expect(sumarMeses(fecha, 0).getTime()).toBe(fecha.getTime());
  });
});

describe('proyectarCiclos', () => {
  // Ejemplo del enunciado: H crece de 0.2 a 0.7 en 2 meses -> tasa = 0.25
  // mm/mes. T no viaja en EstadoActualDisco, se deriva de h+rd = 0.2+5.0=5.2
  // y se mantiene fijo durante el crecimiento. Con los umbrales por defecto
  // (h_umbral_reperfilado=1.6, reperfilado_descuento_rd=0.8,
  // rd_umbral_seguimiento=0.4), verificado con números concretos:
  //   meses = (1.6 - 0.2) / 0.25 = 5.6
  //   rd en el cruce (rdAntes) = rd_actual - 0.25*5.6 = 5.0 - 1.4 = 3.6
  //   rd tras el descuento (rdDespues) = 3.6 - 0.8 = 2.8
  it('calcula el primer ciclo con la tasa derivada del ejemplo (H: 0.2 -> 0.7 en 2 meses)', () => {
    const tasaMensual = (0.7 - 0.2) / 2; // 0.25 mm/mes
    const fechaActual = new Date('2026-01-01T00:00:00.000Z');
    const resultado = proyectarCiclos(
      { h: 0.2, rd: 5.0, fecha: fechaActual },
      tasaMensual,
      UMBRALES_POR_DEFECTO,
    );

    // Solo se verifica el PRIMER ciclo contra la fórmula (con rd=5.0 el disco
    // sigue viable más allá de este ciclo — cuántos ciclos siguen no es lo
    // que este caso puntual del enunciado prueba).
    const [ciclo] = resultado.ciclosReperfilado;
    expect(ciclo.numero).toBe(1);
    expect(ciclo.mesesHastaFecha).toBeCloseTo(5.6, 6);
    expect(ciclo.hEnEseMomento).toBeCloseTo(1.6, 6);
    expect(ciclo.tEnEseMomento).toBeCloseTo(5.2, 6); // T = h+rd = 0.2+5.0
    expect(ciclo.rdAntes).toBeCloseTo(3.6, 6);
    expect(ciclo.rdDespues).toBeCloseTo(2.8, 6);
    expect(mesesEntre(fechaActual, ciclo.fechaEstimada)).toBeCloseTo(5.6, 3);
  });

  it('condición de cambio en el segundo ciclo: NO proyecta un tercero', () => {
    const umbrales: UmbralesProyeccion = {
      hUmbralReperfilado: 1.0,
      reperfiladoDescuentoRd: 0.7,
      rdUmbralSeguimiento: 0.4,
      rdUmbralCambioProyeccion: 0.4,
    };
    const resultado = proyectarCiclos(
      { h: 0.5, rd: 2.0, fecha: new Date('2026-01-01T00:00:00.000Z') },
      0.1,
      umbrales,
    );

    // Ciclo 1: T = h+rd = 0.5+2.0 = 2.5. meses=(1.0-0.5)/0.1=5, rdAntes =
    // 2.0-0.5=1.5, rdDespues=1.5-0.7=0.8 (>0.4) -> viable, se registra. El
    // siguiente ciclo arranca con H=0 y T=2.5-0.7=1.8 (T pierde el
    // descuento, NO H).
    expect(resultado.ciclosReperfilado).toHaveLength(1);
    expect(resultado.ciclosReperfilado[0].mesesHastaFecha).toBeCloseTo(5, 6);
    expect(resultado.ciclosReperfilado[0].hEnEseMomento).toBeCloseTo(1.0, 6);
    expect(resultado.ciclosReperfilado[0].tEnEseMomento).toBeCloseTo(2.5, 6);
    expect(resultado.ciclosReperfilado[0].rdAntes).toBeCloseTo(1.5, 6);
    expect(resultado.ciclosReperfilado[0].rdDespues).toBeCloseTo(0.8, 6);

    // Ciclo 2: arranca con H=0 y T=1.8 -> meses=(1.0-0)/0.1=10, rdAntes =
    // 1.8-1.0=0.8 (mismo valor que rdDespues del ciclo 1, por construcción:
    // rdAntes_(n+1) = T_(n+1) - h_umbral = rdDespues_n), rdDespues=0.8-0.7=0.1
    // (<=0.4) -> YA NO es viable: pasa a cambio, y el ciclo NO se agrega a
    // ciclosReperfilado (sigue en longitud 1).
    expect(resultado.ciclosReperfilado).toHaveLength(1);
    // mesesHastaFecha = 5 (ciclo1) + 10 (crecimiento ciclo2) + 8
    // (rdAntes/tasaMensual = 0.8/0.1, interpolación sin cambios) = 23.
    expect(resultado.cicloCambio.mesesHastaFecha).toBeCloseTo(23, 6);
  });

  // Punto 1 del enunciado: se elimina el tope de 5 ciclos. Umbrales elegidos
  // para que hagan falta exactamente 8 reperfilados viables antes de que el
  // 9° ya no lo sea (ver cálculo cycle-by-cycle en el comentario del test).
  it('sin cap de ciclos: con una tasa de desgaste baja, sigue más allá de 5 reperfilados hasta la condición real de Cambio (8 ciclos)', () => {
    const umbrales: UmbralesProyeccion = {
      hUmbralReperfilado: 1.0,
      reperfiladoDescuentoRd: 0.5,
      rdUmbralSeguimiento: 0.0,
      rdUmbralCambioProyeccion: 0.0,
    };
    const resultado = proyectarCiclos(
      { h: 0.5, rd: 5.0, fecha: new Date('2026-01-01T00:00:00.000Z') },
      0.1,
      umbrales,
    );

    // rdDespues decrece 0.5 por ciclo (4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0,
    // 0.5) -- viable en los 8 primeros (>0.0), el 9° (0.0) ya no lo es y
    // pasa a cicloCambio en su lugar: ciclosReperfilado devuelve el detalle
    // COMPLETO de los 8, sin capar a 5.
    expect(resultado.ciclosReperfilado).toHaveLength(8);
    expect(resultado.ciclosReperfilado.map((c) => c.numero)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(resultado.ciclosReperfilado[7].rdDespues).toBeCloseTo(0.5, 6);

    // cicloCambio SIEMPRE se calcula (nunca null) -- acá converge recién en
    // el que sería el ciclo 9: mesesHastaFecha = 75 (8 ciclos: 5 + 7*10) +
    // 10 (crecimiento del 9°) + 5 (rdAntes/tasaMensual = 0.5/0.1) = 90.
    expect(resultado.cicloCambio.mesesHastaFecha).toBeCloseTo(90, 6);
  });

  // Salvaguarda técnica (no de negocio, ver comentario en el motor): sin una
  // tasa positiva, H nunca cruzaría el umbral de reperfilado -- el motor
  // debe cortar con un error claro en vez de colgarse o devolver
  // Infinity/NaN silenciosamente.
  it('tasa de desgaste 0 (H aún no llegó al umbral): lanza ProyeccionNoConvergeError en vez de colgarse', () => {
    expect(() =>
      proyectarCiclos(
        { h: 0.2, rd: 5.0, fecha: new Date('2026-01-01T00:00:00.000Z') },
        0,
        UMBRALES_POR_DEFECTO,
      ),
    ).toThrow(ProyeccionNoConvergeError);
  });

  it('tasa de desgaste negativa: lanza ProyeccionNoConvergeError', () => {
    expect(() =>
      proyectarCiclos(
        { h: 0.2, rd: 5.0, fecha: new Date('2026-01-01T00:00:00.000Z') },
        -0.1,
        UMBRALES_POR_DEFECTO,
      ),
    ).toThrow(ProyeccionNoConvergeError);
  });

  // Otro caso patológico distinto de tasa<=0: un reperfiladoDescuentoRd=0
  // nunca reduce Rd entre ciclos (T no pierde nada al "reperfilarse") -> los
  // ciclos se repiten IDÉNTICOS para siempre. Acá el límite técnico de
  // seguridad (no la detección de tasa<=0) es lo que corta el cálculo.
  it('reperfiladoDescuentoRd=0 (Rd nunca decrece entre ciclos): alcanza el límite técnico de seguridad y lanza el mismo error', () => {
    const umbrales: UmbralesProyeccion = {
      hUmbralReperfilado: 1.0,
      reperfiladoDescuentoRd: 0,
      rdUmbralSeguimiento: 0.4,
      rdUmbralCambioProyeccion: 0.4,
    };
    expect(() =>
      proyectarCiclos(
        { h: 0.5, rd: 5.0, fecha: new Date('2026-01-01T00:00:00.000Z') },
        0.1,
        umbrales,
      ),
    ).toThrow(ProyeccionNoConvergeError);
  });

  it('H ya en o sobre el umbral (disco ya en REPERFILADO): 0 meses, sin fecha en el pasado', () => {
    const fechaActual = new Date('2026-01-01T00:00:00.000Z');
    const resultado = proyectarCiclos(
      { h: 2.0, rd: 5.0, fecha: fechaActual }, // h=2.0 > 1.6
      0.25,
      UMBRALES_POR_DEFECTO,
    );

    expect(resultado.ciclosReperfilado[0].mesesHastaFecha).toBe(0);
    expect(resultado.ciclosReperfilado[0].fechaEstimada.getTime()).toBe(
      fechaActual.getTime(),
    );
    // H ya estaba en 2.0 (no en el umbral 1.6) al momento del reperfilado.
    expect(resultado.ciclosReperfilado[0].hEnEseMomento).toBeCloseTo(2.0, 6);
  });

  // Ejemplo numérico exacto del enunciado: T=7 fijo durante el crecimiento
  // (h+rd = 0.6+6.4=7), H crece de 0.6 a 1.6 (el umbral) en 2 meses a razón
  // de 0.5 mm/mes -> rdAntes=7-1.6=5.4, rdDespues=5.4-0.8=4.6 (viable, ya que
  // 4.6 > 0.4). La corrección central del modelo: el SIGUIENTE ciclo arranca
  // con H=0 (no con H=0.8) y T=7-0.8=6.2 (T pierde el descuento, NO H).
  it('ejemplo numérico exacto: T=7, H crece hasta 1.6 -> rdAntes=5.4, rdDespues=4.6 (viable); el siguiente ciclo arranca con H=0 y T=6.2', () => {
    const fechaActual = new Date('2026-01-01T00:00:00.000Z');
    const tasaMensual = 0.5;
    const actual = { h: 0.6, rd: 6.4, fecha: fechaActual }; // T = 0.6+6.4 = 7

    const resultado = proyectarCiclos(
      actual,
      tasaMensual,
      UMBRALES_POR_DEFECTO,
    );

    const [ciclo1, ciclo2] = resultado.ciclosReperfilado;
    expect(ciclo1.hEnEseMomento).toBeCloseTo(1.6, 6);
    expect(ciclo1.tEnEseMomento).toBeCloseTo(7, 6);
    expect(ciclo1.rdAntes).toBeCloseTo(5.4, 6);
    expect(ciclo1.rdDespues).toBeCloseTo(4.6, 6);

    // El ciclo 2 arranca con T=7-0.8=6.2 (NO con T=rdDespues=4.6, y NO con
    // H=0+0.8=0.8): tEnEseMomento del segundo ciclo es la base real que usó.
    expect(ciclo2.tEnEseMomento).toBeCloseTo(6.2, 6);

    // Confirmación independiente vía interpolarEnFecha: en la fecha exacta
    // del primer reperfilado, el punto proyectado da H=0 y Rd=6.2 (=
    // T_siguiente - H_siguiente = 6.2 - 0), no Rd=rdDespues=4.6.
    const punto = interpolarEnFecha(
      actual,
      resultado.ciclosReperfilado,
      tasaMensual,
      ciclo1.fechaEstimada,
    );
    expect(punto.h).toBeCloseTo(0, 6);
    expect(punto.rd).toBeCloseTo(6.2, 6);
  });
});

describe('interpolarEnFecha', () => {
  const fechaActual = new Date('2026-01-01T00:00:00.000Z');
  const actual = { h: 0.2, rd: 5.0, fecha: fechaActual };
  const tasaMensual = 0.25;

  it('antes del primer ciclo: crece linealmente desde el estado actual', () => {
    const fecha = sumarMeses(fechaActual, 2);
    const punto = interpolarEnFecha(actual, [], tasaMensual, fecha);
    expect(punto.h).toBeCloseTo(0.2 + 0.25 * 2, 6);
    expect(punto.rd).toBeCloseTo(5.0 - 0.25 * 2, 6);
  });

  // Umbrales/tasa elegidos para que quede EXACTAMENTE un ciclo de reperfilado
  // antes de la condición de cambio (mismo caso que "condición de cambio en
  // el segundo ciclo" de proyectarCiclos) — así el checkpoint tras el ciclo
  // único no tiene ambigüedad con ciclos posteriores.
  const umbralesUnSoloCiclo: UmbralesProyeccion = {
    hUmbralReperfilado: 1.0,
    reperfiladoDescuentoRd: 0.7,
    rdUmbralSeguimiento: 0.4,
    rdUmbralCambioProyeccion: 0.4,
  };
  const actualUnSoloCiclo = { h: 0.5, rd: 2.0, fecha: fechaActual };
  const tasaUnSoloCiclo = 0.1;

  it('después de un ciclo de reperfilado: continúa desde el checkpoint del ciclo (H=0, Rd=T_siguiente)', () => {
    const { ciclosReperfilado } = proyectarCiclos(
      actualUnSoloCiclo,
      tasaUnSoloCiclo,
      umbralesUnSoloCiclo,
    );
    expect(ciclosReperfilado).toHaveLength(1);
    const [ciclo] = ciclosReperfilado;
    const fechaLuego = sumarMeses(ciclo.fechaEstimada, 3);

    const punto = interpolarEnFecha(
      actualUnSoloCiclo,
      ciclosReperfilado,
      tasaUnSoloCiclo,
      fechaLuego,
    );
    // rdDespues(0.8) + hEnEseMomento(1.0) = 1.8 = T_siguiente(2.5-0.7) - H(0).
    const rdJustoTrasReperfilado = ciclo.rdDespues + ciclo.hEnEseMomento;
    expect(punto.h).toBeCloseTo(0 + tasaUnSoloCiclo * 3, 6);
    expect(punto.rd).toBeCloseTo(
      rdJustoTrasReperfilado - tasaUnSoloCiclo * 3,
      6,
    );
  });

  it('en la fecha exacta de un ciclo, da el estado justo tras el reperfilado (H=0, Rd=T_siguiente)', () => {
    const { ciclosReperfilado } = proyectarCiclos(
      actualUnSoloCiclo,
      tasaUnSoloCiclo,
      umbralesUnSoloCiclo,
    );
    const [ciclo] = ciclosReperfilado;

    const punto = interpolarEnFecha(
      actualUnSoloCiclo,
      ciclosReperfilado,
      tasaUnSoloCiclo,
      ciclo.fechaEstimada,
    );
    expect(punto.h).toBeCloseTo(0, 6);
    expect(punto.rd).toBeCloseTo(ciclo.rdDespues + ciclo.hEnEseMomento, 6);
  });
});

describe('generarMesesForecast / fechaCaeEnMes', () => {
  it('genera 12 meses consecutivos empezando en el mes de "hoy"', () => {
    const hoy = new Date('2026-03-15T12:00:00.000Z');
    const meses = generarMesesForecast(hoy, 12);
    expect(meses).toHaveLength(12);
    expect(meses[0].mes).toBe('2026-03');
    expect(meses[11].mes).toBe('2027-02');
  });

  it('fechaCaeEnMes: dentro del rango [inicio, fin) es true, fuera es false', () => {
    const hoy = new Date('2026-03-15T12:00:00.000Z');
    const [marzo] = generarMesesForecast(hoy, 1);
    expect(fechaCaeEnMes(new Date('2026-03-01T00:00:00.000Z'), marzo)).toBe(
      true,
    );
    expect(fechaCaeEnMes(new Date('2026-03-31T23:59:59.999Z'), marzo)).toBe(
      true,
    );
    expect(fechaCaeEnMes(new Date('2026-04-01T00:00:00.000Z'), marzo)).toBe(
      false,
    );
    expect(fechaCaeEnMes(new Date('2026-02-28T23:59:59.999Z'), marzo)).toBe(
      false,
    );
  });
});
