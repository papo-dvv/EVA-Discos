import { Injectable } from '@nestjs/common';
import {
  catalogoRelacionBogies,
  type RelacionBogieCatalogo,
} from '../new-measurement/new-measurement-bogie-codes';

function normalizarTexto(valor: unknown): string {
  return String(valor ?? '')
    .trim()
    .toUpperCase();
}

function normalizarCodigoDisco(valor: unknown): string {
  const codigo = normalizarTexto(valor);
  return codigo.endsWith('-D') ? codigo : `${codigo}-D`;
}

@Injectable()
export class ResolverCodigoDiscoService {
  resolver(
    tren: number,
    coche: string,
    bogie: string,
    _eje: number,
  ): string | null {
    const relacion = this.buscarRelacion(tren, coche, bogie);
    return relacion?.ejeActual ? `${relacion.ejeActual}-D` : null;
  }

  buscarRelacion(
    tren: number,
    coche: string,
    bogie: string,
  ): RelacionBogieCatalogo | null {
    const cocheNormalizado = normalizarTexto(coche);
    const bogieNormalizado = normalizarTexto(bogie);
    return (
      catalogoRelacionBogies().find(
        (fila) =>
          fila.trenNumero === Number(tren) &&
          fila.coche === cocheNormalizado &&
          fila.posicion === bogieNormalizado,
      ) ?? null
    );
  }

  buscarPorCodigo(codigoDisco: string): RelacionBogieCatalogo | null {
    const codigoNormalizado = normalizarCodigoDisco(codigoDisco);
    return (
      catalogoRelacionBogies().find(
        (fila) =>
          fila.ejeActual &&
          normalizarCodigoDisco(fila.ejeActual) === codigoNormalizado,
      ) ?? null
    );
  }
}
