import { calcularOrdenFisico, type IdentidadFisica } from './orden-fisico';

function orden(overrides: Partial<IdentidadFisica>): number {
  return calcularOrdenFisico({
    tipoCoche: 'MA1',
    bogieCodigo: 'PB3',
    ejeNumero: 1,
    ruedaNumero: 1,
    ...overrides,
  });
}

describe('calcularOrdenFisico', () => {
  it('ordena los coches según la disposición física real, NO alfabética', () => {
    // Alfabético sería MA1,MA2,MB1,MB2,MB3,REM — el físico real es distinto.
    const secuenciaFisica = ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2'];
    const ordenes = secuenciaFisica.map((coche) => orden({ tipoCoche: coche }));
    for (let i = 1; i < ordenes.length; i++) {
      expect(ordenes[i]).toBeGreaterThan(ordenes[i - 1]);
    }
  });

  it('MA1: bogie PB3 antes que PB4', () => {
    const pb3 = orden({ tipoCoche: 'MA1', bogieCodigo: 'PB3' });
    const pb4 = orden({ tipoCoche: 'MA1', bogieCodigo: 'PB4' });
    expect(pb3).toBeLessThan(pb4);
  });

  it('MA2: el mismo par PB3/PB4 pero en orden INVERSO a MA1 (PB4 antes que PB3)', () => {
    const pb4 = orden({ tipoCoche: 'MA2', bogieCodigo: 'PB4' });
    const pb3 = orden({ tipoCoche: 'MA2', bogieCodigo: 'PB3' });
    expect(pb4).toBeLessThan(pb3);
  });

  it('MB1 y MB3: bogie PB6 antes que PB2', () => {
    for (const coche of ['MB1', 'MB3']) {
      const pb6 = orden({ tipoCoche: coche, bogieCodigo: 'PB6' });
      const pb2 = orden({ tipoCoche: coche, bogieCodigo: 'PB2' });
      expect(pb6).toBeLessThan(pb2);
    }
  });

  it('MB2: el mismo par PB6/PB2 pero en orden INVERSO a MB1/MB3 (PB2 antes que PB6)', () => {
    const pb2 = orden({ tipoCoche: 'MB2', bogieCodigo: 'PB2' });
    const pb6 = orden({ tipoCoche: 'MB2', bogieCodigo: 'PB6' });
    expect(pb2).toBeLessThan(pb6);
  });

  it('REM: bogie TB1 antes que TB2', () => {
    const tb1 = orden({ tipoCoche: 'REM', bogieCodigo: 'TB1' });
    const tb2 = orden({ tipoCoche: 'REM', bogieCodigo: 'TB2' });
    expect(tb1).toBeLessThan(tb2);
  });

  it('eje ASC dentro del mismo coche+bogie', () => {
    const eje1 = orden({ ejeNumero: 1 });
    const eje2 = orden({ ejeNumero: 2 });
    expect(eje1).toBeLessThan(eje2);
  });

  it('rueda ASC dentro del mismo coche+bogie+eje', () => {
    const rueda1 = orden({ ruedaNumero: 1 });
    const rueda2 = orden({ ruedaNumero: 2 });
    expect(rueda1).toBeLessThan(rueda2);
  });

  it('coche desconocido cae al final, después de cualquier coche real', () => {
    const desconocido = orden({ tipoCoche: 'XYZ' });
    const ultimoConocido = orden({ tipoCoche: 'MA2' });
    expect(desconocido).toBeGreaterThan(ultimoConocido);
  });

  it('coche null cae al final', () => {
    const nulo = orden({ tipoCoche: null });
    const conocido = orden({ tipoCoche: 'MA2' });
    expect(nulo).toBeGreaterThan(conocido);
  });

  it('bogie que no pertenece a ese coche cae al final DENTRO de ese coche (nunca se mezcla con otro coche)', () => {
    const bogieAjeno = orden({ tipoCoche: 'MA1', bogieCodigo: 'TB1' }); // TB1 es de REM, no de MA1
    const ultimoBogieValido = orden({ tipoCoche: 'MA1', bogieCodigo: 'PB4' });
    const primerBogieDelSiguienteCoche = orden({
      tipoCoche: 'MB1',
      bogieCodigo: 'PB6',
    });
    expect(bogieAjeno).toBeGreaterThan(ultimoBogieValido);
    expect(bogieAjeno).toBeLessThan(primerBogieDelSiguienteCoche);
  });

  it('eje null cae al final dentro de su coche+bogie', () => {
    const nulo = orden({ ejeNumero: null });
    const conocido = orden({ ejeNumero: 5 });
    expect(nulo).toBeGreaterThan(conocido);
  });

  it('rueda null cae al final dentro de su eje', () => {
    const nulo = orden({ ruedaNumero: null });
    const conocida = orden({ ruedaNumero: 48 });
    expect(nulo).toBeGreaterThan(conocida);
  });

  it('es insensible a mayúsculas/minúsculas y espacios en coche/bogie', () => {
    expect(orden({ tipoCoche: ' ma1 ', bogieCodigo: ' pb3 ' })).toBe(
      orden({ tipoCoche: 'MA1', bogieCodigo: 'PB3' }),
    );
  });

  it('coche siempre pesa más que bogie, que siempre pesa más que eje, que siempre pesa más que rueda', () => {
    // El PEOR caso dentro de un coche (último bogie/eje/rueda) debe seguir
    // siendo MENOR que el MEJOR caso del siguiente coche.
    const peorDeMA1 = orden({
      tipoCoche: 'MA1',
      bogieCodigo: 'PB4',
      ejeNumero: 99,
      ruedaNumero: 48,
    });
    const mejorDeMB1 = orden({
      tipoCoche: 'MB1',
      bogieCodigo: 'PB6',
      ejeNumero: 0,
      ruedaNumero: 1,
    });
    expect(peorDeMA1).toBeLessThan(mejorDeMB1);
  });
});
