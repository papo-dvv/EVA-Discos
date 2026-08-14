import { Injectable } from '@nestjs/common';
import {
  ModuloSnapshot,
  Prisma,
  type ModuleSnapshot,
} from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { ProyeccionService } from '../projection/proyeccion.service';
import { TraceabilityService } from '../traceability/traceability.service';

// "Proyección completa por disco" del snapshot mensual necesita TODOS los
// discos activos de la flota en una sola pasada, no la página de 25 que usa
// la pantalla (ver ProyeccionService.listarDiscos) — la flota completa hoy
// es a lo sumo un par de miles de discos, muy lejos de este techo.
const PAGE_SIZE_SNAPSHOT_COMPLETO = 100_000;

function esViolacionUnicidad(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  );
}

// 'YYYY-MM' del mes calendario del SERVIDOR al momento de generar — nunca un
// mes que venga del cliente ni derivado después a partir de generadoEn.
function mesAnioActual(): string {
  const ahora = new Date();
  return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
}

// Genera el snapshot mensual de Trazabilidad/Proyección: una copia completa
// de todos los cálculos de ese módulo en un momento dado, para que el
// frontend pueda mostrar "Última actualización: [fecha]" sin recalcular todo
// en vivo cada vez que alguien abre la pantalla.
//
// PENDIENTE DE CONECTAR A UN BOTÓN DE UI cuando exista el módulo de registro
// de nuevas mediciones (aún no desarrollado): hoy no hay forma de que un
// usuario genere mediciones nuevas fuera de la migración masiva, así que
// "actualizar manualmente" no tendría datos distintos que mostrar todavía.
// Por ahora los únicos disparadores son automáticos — el primer arranque del
// proceso (ver SnapshotBootstrapService) y el primer commit exitoso de la
// migración masiva (ver MigrationCommitService.confirmar), lo que ocurra
// primero. generar() en sí ya queda lista: un futuro endpoint de
// "actualizar manualmente" solo tendría que invocarla con el usuario actual.
@Injectable()
export class GenerarSnapshotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly traceability: TraceabilityService,
    private readonly proyeccion: ProyeccionService,
  ) {}

  // Upsert-SI-NO-EXISTE por (modulo, mesAnio): "solo se conserva la primera
  // actualización del mes" — un segundo llamado en el mismo mes calendario
  // NUNCA sobrescribe el snapshot ya guardado (ni siquiera recalcula nada),
  // solo devuelve el que ya existe tal cual. `generadoPor` null = generado
  // automáticamente por el sistema (el único caso posible hoy).
  async generar(
    modulo: ModuloSnapshot,
    generadoPor: string | null = null,
  ): Promise<ModuleSnapshot> {
    const mesAnio = mesAnioActual();
    const existente = await this.prisma.moduleSnapshot.findUnique({
      where: { modulo_mesAnio: { modulo, mesAnio } },
    });
    if (existente) return existente;

    const datosCompletos = await this.calcularDatosCompletos(modulo);

    try {
      return await this.prisma.moduleSnapshot.create({
        data: { modulo, mesAnio, datosCompletos, generadoPor },
      });
    } catch (err) {
      // Los 2 disparadores automáticos (arranque del proceso y primer commit
      // de migración) pueden chocar en una carrera real dentro del mismo mes
      // — mismo criterio de "reconsultar y reusar" que
      // MigrationCommitService.resolverWagonUnit/resolverBrakeDisc.
      if (esViolacionUnicidad(err)) {
        const existenteAhora = await this.prisma.moduleSnapshot.findUnique({
          where: { modulo_mesAnio: { modulo, mesAnio } },
        });
        if (existenteAhora) return existenteAhora;
      }
      throw err;
    }
  }

  // Snapshot más reciente de un módulo (por generadoEn) — null si todavía no
  // se generó ninguno (ej. el proceso recién arrancó y
  // SnapshotBootstrapService no terminó). Ver ModuleSnapshotController.
  async obtenerUltimo(modulo: ModuloSnapshot): Promise<ModuleSnapshot | null> {
    return this.prisma.moduleSnapshot.findFirst({
      where: { modulo },
      orderBy: { generadoEn: 'desc' },
    });
  }

  private async calcularDatosCompletos(
    modulo: ModuloSnapshot,
  ): Promise<Prisma.InputJsonValue> {
    return modulo === ModuloSnapshot.trazabilidad
      ? this.calcularTrazabilidad()
      : this.calcularProyeccion();
  }

  // Fleet-wide (scope vacío, filtrarPorRangoKm=true — mismo default que ve
  // la pantalla): límites de los 3 métodos + consenso + estadísticas
  // generales + asimetría (todo dentro de `summary`), más los 2 promedios
  // que se muestran junto a esas cards (ver PanelLateralTrazabilidad) — los
  // 39 trenes SIN desglose por tipoCoche (incluirDetalle=false, igual que la
  // card principal de la pantalla) y promedio por tipo de coche (reutilizado
  // de Proyección, el mismo dato que ya consume la propia pantalla de
  // Trazabilidad vía usePromedioPorVagon).
  private async calcularTrazabilidad(): Promise<Prisma.InputJsonValue> {
    const [summary, promedioPorTren, promedioPorVagon] = await Promise.all([
      this.traceability.obtenerSummary({ filtrarPorRangoKm: true }),
      this.traceability.obtenerPromedioPorTren(true, false),
      this.proyeccion.obtenerPromedioPorVagon(),
    ]);
    // Cast necesario: Prisma.InputJsonValue es intencionalmente estricto a
    // nivel estructural y no reconoce interfaces propias como
    // TraceabilitySummaryResponse, aunque el objeto real ya es JSON-serializable
    // sin más (son los mismos objetos que HTTP ya devuelve como body de
    // /traceability/summary, /traceability/promedio-por-tren, etc.).
    return {
      summary,
      promedioPorTren,
      promedioPorVagon,
    } as unknown as Prisma.InputJsonValue;
  }

  // Fleet-wide (sin filtro de tren): TODOS los discos activos con su
  // proyección completa (no la página de 25 que usa la pantalla, ver
  // PAGE_SIZE_SNAPSHOT_COMPLETO), el pronóstico de 12 meses agregado y el
  // promedio por tipo de coche — los 3 datasets que alimentan toda la
  // pantalla de Proyección.
  private async calcularProyeccion(): Promise<Prisma.InputJsonValue> {
    const [discos, pronostico12Meses, promedioPorVagon] = await Promise.all([
      this.proyeccion.listarDiscos({
        page: 1,
        pageSize: PAGE_SIZE_SNAPSHOT_COMPLETO,
      }),
      this.proyeccion.obtenerPronostico({ meses: 12 }),
      this.proyeccion.obtenerPromedioPorVagon(),
    ]);
    return {
      discos,
      pronostico12Meses,
      promedioPorVagon,
    } as unknown as Prisma.InputJsonValue;
  }
}
