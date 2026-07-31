import { Injectable } from '@nestjs/common';
import {
  BrakeDiscRulesEngine,
  calcularRd,
  type EstadoDiscoCalculado,
  type MedicionDisco,
  type ResultadoAccionRecomendada,
} from './brake-disc-rules.engine';
import type { Umbrales } from './umbrales';
import { UmbralesProviderService } from './umbrales-provider.service';

// Fachada inyectable: resuelve los umbrales vigentes (SystemParam, con
// fallback) y delega el cálculo en BrakeDiscRulesEngine, que es puro y no
// sabe nada de Prisma. calcularRd no necesita umbrales, por eso es la única
// operación que se mantiene síncrona también acá.
@Injectable()
export class BrakeDiscRulesService {
  constructor(private readonly umbralesProvider: UmbralesProviderService) {}

  calcularRd(t: number, h: number): number {
    return calcularRd(t, h);
  }

  // Resuelve los umbrales UNA sola vez y devuelve un motor listo para usar en
  // lote (ej. procesar miles de filas de una migración sin pegarle a la base
  // por cada fila). El motor es puro y síncrono; el cálculo por fila no vuelve
  // a tocar la base.
  async obtenerEvaluador(): Promise<BrakeDiscRulesEngine> {
    const umbrales = await this.umbralesProvider.obtenerUmbrales();
    return new BrakeDiscRulesEngine(umbrales);
  }

  async clasificarEstado(rd: number): Promise<EstadoDiscoCalculado> {
    const umbrales = await this.umbralesProvider.obtenerUmbrales();
    return new BrakeDiscRulesEngine(umbrales).clasificarEstado(rd);
  }

  // Umbrales crudos (no envueltos en un motor) — para quien necesita
  // traducir un filtro de estado[] a un rango numérico de WHERE en vez de
  // clasificar fila por fila (ver wear-rate-pairs-query.ts: rd2 no tiene una
  // columna estadoCalculado propia, a diferencia de ScanRecord).
  async obtenerUmbrales(): Promise<Umbrales> {
    return this.umbralesProvider.obtenerUmbrales();
  }

  async evaluarAccionRecomendada(
    discoIzquierdo: MedicionDisco,
    discoDerecho: MedicionDisco,
  ): Promise<ResultadoAccionRecomendada> {
    const umbrales = await this.umbralesProvider.obtenerUmbrales();
    return new BrakeDiscRulesEngine(umbrales).evaluarAccionRecomendada(
      discoIzquierdo,
      discoDerecho,
    );
  }
}
