import { agruparPorMes, ordenarPorMes } from './agrupar-por-mes';

interface Medicion {
  fecha: Date;
  valor: number;
}

interface Acumulado {
  suma: number;
  conteo: number;
}

function acumuladorSuma() {
  return {
    inicial: (): Acumulado => ({ suma: 0, conteo: 0 }),
    reducir: (acumulado: Acumulado, item: Medicion): Acumulado => {
      acumulado.suma += item.valor;
      acumulado.conteo += 1;
      return acumulado;
    },
  };
}

describe('agruparPorMes', () => {
  it('agrupa por YYYY-MM y acumula con el reductor del llamador', () => {
    const items: Medicion[] = [
      { fecha: new Date('2026-01-05'), valor: 10 },
      { fecha: new Date('2026-01-20'), valor: 20 },
      { fecha: new Date('2026-02-01'), valor: 30 },
    ];
    const { inicial, reducir } = acumuladorSuma();

    const porMes = agruparPorMes(items, (i) => i.fecha, inicial, reducir);

    expect(porMes.get('2026-01')).toEqual({ suma: 30, conteo: 2 });
    expect(porMes.get('2026-02')).toEqual({ suma: 30, conteo: 1 });
    expect(porMes.size).toBe(2);
  });

  it('lista vacía -> Map vacío', () => {
    const { inicial, reducir } = acumuladorSuma();
    expect(
      agruparPorMes<Medicion, Acumulado>([], (i) => i.fecha, inicial, reducir)
        .size,
    ).toBe(0);
  });

  it('un solo ítem crea un solo balde', () => {
    const { inicial, reducir } = acumuladorSuma();
    const porMes = agruparPorMes(
      [{ fecha: new Date('2026-03-15'), valor: 5 }],
      (i) => i.fecha,
      inicial,
      reducir,
    );
    expect([...porMes.keys()]).toEqual(['2026-03']);
  });
});

describe('ordenarPorMes', () => {
  it('ordena cronológicamente aunque el Map se haya poblado fuera de orden', () => {
    const porMes = new Map<string, number>([
      ['2026-03', 3],
      ['2026-01', 1],
      ['2026-02', 2],
    ]);

    expect(ordenarPorMes(porMes)).toEqual([
      ['2026-01', 1],
      ['2026-02', 2],
      ['2026-03', 3],
    ]);
  });
});
