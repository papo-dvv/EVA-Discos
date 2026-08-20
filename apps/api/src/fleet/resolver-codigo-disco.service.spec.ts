import { ResolverCodigoDiscoService } from './resolver-codigo-disco.service';

jest.mock('../new-measurement/new-measurement-bogie-codes', () => ({
  catalogoRelacionBogies: jest.fn(() => [
    {
      id: '6:MA1:PB3',
      trenNumero: 6,
      trenCodigo: 'T06',
      coche: 'MA1',
      numeroCoche: null,
      posicion: 'PB3',
      serieBogie: '017',
      bogieActual: 'PB3/017',
      ejeActual: 'M146',
      fechaUltimoCambio: null,
    },
  ]),
}));

describe('ResolverCodigoDiscoService', () => {
  it('resuelve codigoDisco desde EJE_ACTUAL del catálogo real', () => {
    const service = new ResolverCodigoDiscoService();

    expect(service.resolver(6, 'ma1', 'pb3', 1)).toBe('M146-D');
  });

  it('busca una relación por codigoDisco normalizado', () => {
    const service = new ResolverCodigoDiscoService();

    expect(service.buscarPorCodigo('m146-d')?.posicion).toBe('PB3');
  });
});
