import { clasificarSemaforoMediciones } from './mediciones-semaforo-config.service';

const UMBRALES = { alerta: 16, critico: 26, prioridad: 31 };

describe('clasificarSemaforoMediciones', () => {
  it('null (nunca medido) siempre es PRIORIDAD', () => {
    expect(clasificarSemaforoMediciones(null, UMBRALES)).toBe('PRIORIDAD');
  });

  it.each([
    [0, 'NORMAL'],
    [15, 'NORMAL'],
    [16, 'ALERTA'],
    [25, 'ALERTA'],
    [26, 'CRITICO'],
    [30, 'CRITICO'],
    [31, 'PRIORIDAD'],
    [200, 'PRIORIDAD'],
  ] as const)('%i días -> %s', (dias, esperado) => {
    expect(clasificarSemaforoMediciones(dias, UMBRALES)).toBe(esperado);
  });
});
