import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  EstadoDisco,
  LadoDisco,
  PosicionDisco,
} from '../../generated/prisma';
import { BrakeDiscRulesService } from '../brake-disc-rules/brake-disc-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  LADOS_DISCO_FLOTA,
  ORDEN_BOGIE_POR_COCHE_ANSALDO,
  ORDEN_BOGIE_POR_COCHE_FLOTA,
  ORDEN_COCHE_ANSALDO,
  ORDEN_COCHE_FLOTA,
  POSICIONES_DISCO_ALSTOM,
  POSICIONES_DISCO_ANSALDO,
  TRENES_FLOTA,
  type CocheFlota,
  type CocheFlotaAnsaldo,
} from './fleet.constants';
import { ResolverCodigoDiscoService } from './resolver-codigo-disco.service';

type MedicionActual = {
  rd: number | null;
  h: number | null;
  t: number | null;
  estadoCalculado: EstadoDisco | null;
  fechaUltimaMedicion: string | null;
};

function fechaIso(fecha: Date | string | null | undefined): string | null {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha.toISOString().slice(0, 10);
  return String(fecha).slice(0, 10);
}

function numero(valor: unknown): number | null {
  if (valor === null || valor === undefined) return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function medicionVacia(): MedicionActual {
  return {
    rd: null,
    h: null,
    t: null,
    estadoCalculado: null,
    fechaUltimaMedicion: null,
  };
}

@Injectable()
export class FleetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reglas: BrakeDiscRulesService,
    private readonly resolverCodigoDisco: ResolverCodigoDiscoService,
  ) {}

  async summary() {
    const evaluador = await this.reglas.obtenerEvaluador();
    const discos = await this.prisma.brakeDisc.findMany({
      where: {
        activo: true,
        // stage: 'en_servicio' es la condición de negocio real ("montado
        // ahora mismo"); el filtro por wagonUnit.tren de abajo ya la implica
        // a nivel de runtime (una relación null nunca matchea), pero se deja
        // explícita para no depender de ese efecto colateral.
        stage: 'en_servicio',
        wagonUnit: { tren: { numero: { in: TRENES_FLOTA } } },
      },
      select: {
        wagonUnit: { select: { tren: { select: { numero: true } } } },
        scanRecords: {
          where: { file: { status: 'committed' } },
          orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: {
            fecha: true,
            hValue: true,
            rdValue: true,
            kilometraje: true,
          },
        },
      },
    });

    const porTren = new Map(
      TRENES_FLOTA.map((tren) => [
        tren,
        {
          tren,
          fechaUltimaMedicion: null as string | null,
          kilometrajeActual: null as number | null,
          // Conteo de discos por estado calculado (los 5 valores posibles de
          // clasificarEstadoConReperfilado) — usado para el semáforo del tren
          // (peor disco gana) y para las KPIs de Flota.
          conteoEstado: {
            ok: 0,
            seguimiento: 0,
            cambio: 0,
            critico: 0,
            reperfilado: 0,
          },
        },
      ]),
    );

    for (const disco of discos) {
      const ultima = disco.scanRecords[0];
      if (!ultima) continue;
      // wagonUnit no-null garantizado por el where (stage: 'en_servicio' +
      // filtro de relación wagonUnit.tren) — Prisma no lo refleja en el tipo.
      const tren = disco.wagonUnit!.tren.numero;
      const fila = porTren.get(tren);
      if (!fila) continue;

      const fecha = fechaIso(ultima.fecha);
      if (
        fecha &&
        (!fila.fechaUltimaMedicion || fecha > fila.fechaUltimaMedicion)
      ) {
        fila.fechaUltimaMedicion = fecha;
        // Kilometraje del tren = lectura de odómetro de su medición más
        // reciente (misma fila que fija fechaUltimaMedicion), no un máximo
        // independiente — evita mezclar km de discos medidos en fechas distintas.
        fila.kilometrajeActual = numero(ultima.kilometraje);
      }

      const estado = evaluador.clasificarEstadoConReperfilado(
        Number(ultima.rdValue),
        Number(ultima.hValue),
      );
      if (estado === 'OK') fila.conteoEstado.ok += 1;
      if (estado === 'SEGUIMIENTO') fila.conteoEstado.seguimiento += 1;
      if (estado === 'CAMBIO') fila.conteoEstado.cambio += 1;
      if (estado === 'CRITICO') fila.conteoEstado.critico += 1;
      if (estado === 'REPERFILADO') fila.conteoEstado.reperfilado += 1;
    }

    return [...porTren.values()].sort((a, b) => a.tren - b.tren);
  }

  async detalle(trenNumero: number) {
    const tren = await this.prisma.train.findUnique({
      where: { numero: trenNumero },
      select: {
        numero: true,
        modelo: true,
        wagonUnits: {
          orderBy: { numeroCoche: 'asc' },
          select: {
            id: true,
            tipoCoche: true,
            numeroCoche: true,
            brakeDiscs: {
              // stage: 'en_servicio' — solo piezas montadas ahora mismo
              // (bogieCodigo/ejeNumero/lado garantizados no-null, ver abajo).
              where: { activo: true, stage: 'en_servicio' },
              select: {
                id: true,
                bogieCodigo: true,
                ejeNumero: true,
                lado: true,
                posicion: true,
                ruedaNumero: true,
              },
            },
          },
        },
      },
    });
    if (!tren) throw new NotFoundException(`El tren ${trenNumero} no existe.`);

    const discIds = tren.wagonUnits.flatMap((coche) =>
      coche.brakeDiscs.map((disco) => disco.id),
    );
    const ultimas = await this.buscarUltimasPorDisco(discIds);
    // Ansaldo (4 discos por eje: lado x posición interior/exterior) vs
    // Alstom (2, un disco por lado — posicion siempre 'unica').
    const esAnsaldo = tren.modelo === 'ansaldo_mb300';
    const posiciones: readonly PosicionDisco[] = esAnsaldo
      ? POSICIONES_DISCO_ANSALDO
      : POSICIONES_DISCO_ALSTOM;

    // bogieCodigo/ejeNumero/lado no-null garantizados por el where de arriba
    // (stage: 'en_servicio') — Prisma no lo refleja en el tipo generado.
    const wagonsNormalizados = tren.wagonUnits.map((wagon) => ({
      ...wagon,
      brakeDiscs: wagon.brakeDiscs.map((disco) => ({
        ...disco,
        bogieCodigo: disco.bogieCodigo!,
        ejeNumero: disco.ejeNumero!,
        lado: disco.lado!,
      })),
    }));

    const construirCoche = (
      wagon: (typeof wagonsNormalizados)[number] | undefined,
      tipoCoche: string,
    ) => {
      const bogiesTipo: readonly string[] = esAnsaldo
        ? ORDEN_BOGIE_POR_COCHE_ANSALDO[tipoCoche as CocheFlotaAnsaldo]
        : ORDEN_BOGIE_POR_COCHE_FLOTA[tipoCoche as CocheFlota];
      return {
        coche: tipoCoche,
        numeroCoche: wagon?.numeroCoche ?? null,
        bogies: bogiesTipo.map((bogie) => {
          const discosBogie =
            wagon?.brakeDiscs.filter((disco) => disco.bogieCodigo === bogie) ??
            [];
          const ejes = this.ejesEsperados(discosBogie);
          return {
            bogie,
            ejes: ejes.map((eje) => ({
              eje,
              discos: LADOS_DISCO_FLOTA.flatMap((lado) =>
                posiciones.map((posicion) => {
                  const disco = discosBogie.find(
                    (d) =>
                      d.ejeNumero === eje &&
                      d.lado === lado &&
                      d.posicion === posicion,
                  );
                  const ultima = disco ? ultimas.get(disco.id) : null;
                  return {
                    codigoDisco: this.resolverCodigoDisco.resolver(
                      tren.numero,
                      tipoCoche,
                      bogie,
                      eje,
                    ),
                    lado,
                    posicion,
                    ...this.mapearMedicion(ultima),
                  };
                }),
              ),
            })),
          };
        }),
      };
    };

    // Alstom: un coche por tipo (ORDEN_COCHE_FLOTA, 1:1). Ansaldo: cada tipo
    // aparece 2 veces por tren (ver ORDEN_COCHE_ANSALDO) — se listan todos
    // los wagon_units reales agrupados por tipo y ordenados por N° de coche,
    // en vez de un mapeo 1:1 tipo->coche.
    const coches = esAnsaldo
      ? ORDEN_COCHE_ANSALDO.flatMap((tipo) =>
          wagonsNormalizados
            .filter((wagon) => wagon.tipoCoche === tipo)
            .map((wagon) => construirCoche(wagon, tipo)),
        )
      : ORDEN_COCHE_FLOTA.map((tipo) => {
          const wagon = wagonsNormalizados.find((w) => w.tipoCoche === tipo);
          return construirCoche(wagon, tipo);
        });

    return { tren: tren.numero, coches };
  }

  async historicoDisco(codigoDisco: string, lado: string) {
    const ladoNormalizado = this.normalizarLado(lado);
    const relacion = this.resolverCodigoDisco.buscarPorCodigo(codigoDisco);
    if (!relacion) {
      throw new NotFoundException(`No se encontró el disco ${codigoDisco}.`);
    }

    const discos = await this.prisma.brakeDisc.findMany({
      where: {
        activo: true,
        lado: ladoNormalizado,
        bogieCodigo: relacion.posicion,
        wagonUnit: {
          tipoCoche: relacion.coche as CocheFlota,
          tren: { numero: relacion.trenNumero },
        },
      },
      orderBy: [{ ejeNumero: 'asc' }, { ruedaNumero: 'asc' }, { id: 'asc' }],
      select: { id: true, ejeNumero: true },
    });
    const disco = discos[0];
    if (!disco) {
      throw new NotFoundException(
        `No se encontró el disco físico ${codigoDisco} (${ladoNormalizado}).`,
      );
    }

    const historico = await this.prisma.scanRecord.findMany({
      where: {
        discId: disco.id,
        file: { status: 'committed' },
      },
      orderBy: [{ fecha: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: {
        fecha: true,
        hValue: true,
        tValue: true,
        rdValue: true,
        estadoCalculado: true,
      },
    });

    const puntos = historico.map((registro) => ({
      fecha: fechaIso(registro.fecha),
      h: numero(registro.hValue),
      t: numero(registro.tValue),
      rd: numero(registro.rdValue),
      estadoCalculado: registro.estadoCalculado,
    }));
    const actual = puntos.at(-1) ?? medicionVacia();

    return {
      codigoDisco: codigoDisco.toUpperCase(),
      lado: ladoNormalizado,
      actual,
      historico: puntos,
    };
  }

  private async buscarUltimasPorDisco(discIds: string[]) {
    if (discIds.length === 0)
      return new Map<
        string,
        Awaited<ReturnType<typeof this.buscarRegistrosUltimos>>[number]
      >();
    const registros = await this.buscarRegistrosUltimos(discIds);
    const porDisco = new Map<string, (typeof registros)[number]>();
    for (const registro of registros) {
      if (registro.discId && !porDisco.has(registro.discId)) {
        porDisco.set(registro.discId, registro);
      }
    }
    return porDisco;
  }

  private buscarRegistrosUltimos(discIds: string[]) {
    return this.prisma.scanRecord.findMany({
      where: {
        discId: { in: discIds },
        file: { status: 'committed' },
      },
      orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
      select: {
        discId: true,
        fecha: true,
        hValue: true,
        tValue: true,
        rdValue: true,
        estadoCalculado: true,
      },
    });
  }

  private ejesEsperados(
    discos: Array<{ ejeNumero: number }>,
  ): [number, number] {
    const ejes = [...new Set(discos.map((disco) => disco.ejeNumero))]
      .sort((a, b) => a - b)
      .slice(0, 2);
    return [ejes[0] ?? 1, ejes[1] ?? 2];
  }

  private mapearMedicion(
    registro:
      | {
          fecha: Date | string;
          hValue: unknown;
          tValue: unknown;
          rdValue: unknown;
          estadoCalculado: EstadoDisco | null;
        }
      | null
      | undefined,
  ): MedicionActual {
    if (!registro) return medicionVacia();
    return {
      rd: numero(registro.rdValue),
      h: numero(registro.hValue),
      t: numero(registro.tValue),
      estadoCalculado: registro.estadoCalculado,
      fechaUltimaMedicion: fechaIso(registro.fecha),
    };
  }

  private normalizarLado(lado: string): LadoDisco {
    const normalizado = lado.trim().toLowerCase();
    if (normalizado !== 'izquierdo' && normalizado !== 'derecho') {
      throw new NotFoundException(`Lado inválido: ${lado}.`);
    }
    return normalizado;
  }
}
