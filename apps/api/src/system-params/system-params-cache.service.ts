import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// TTL defensivo: cubre el caso de múltiples instancias del proceso (una
// actualiza un parámetro, las otras todavía no se enteran) — en un solo
// proceso, `invalidar()` (llamado por SystemParamsService.actualizar tras
// cada escritura exitosa) ya deja el caché al día al instante, así que este
// TTL casi nunca llega a cumplirse en desarrollo/single-instance.
const TTL_MS = 30_000;

// Toda la tabla system_params son unas pocas decenas de filas que casi nunca
// cambian entre requests, pero se releían constantemente (hasta una vez por
// disco en Proyección — ver ProyeccionService.resolverUmbralesProyeccion, y
// hasta una vez por tren en Trazabilidad/promedio-por-tren). Este caché en
// memoria evita ese round-trip repetido: los 5 servicios que antes hacían su
// propio `prisma.systemParam.findMany/findUnique` (UmbralesProviderService,
// ConsensoConfigService, AsimetriaConfigService, ProyeccionConfigService,
// ProyeccionUmbralesService) ahora piden el mapa completo acá.
//
// @Global() (ver system-params-cache.module.ts) para que sea un ÚNICO
// singleton compartido por toda la app, sin importar que cada uno de esos 5
// servicios viva en un módulo distinto con su propia instancia — así
// `invalidar()` desde SystemParamsService.actualizar() se ve reflejado para
// TODOS de inmediato, sin depender de que cada consumidor comparta módulo.
@Injectable()
export class SystemParamsCacheService {
  constructor(private readonly prisma: PrismaService) {}

  private cache: Map<string, string> | null = null;
  private vencimiento = 0;
  // Evita que N lecturas concurrentes (ej. Promise.all sobre ~1900 discos en
  // Proyección) disparen N SELECT idénticos mientras el caché está frío —
  // todas comparten la misma promesa de carga en curso.
  private cargando: Promise<Map<string, string>> | null = null;

  async obtenerTodos(): Promise<Map<string, string>> {
    if (this.cache && Date.now() < this.vencimiento) return this.cache;
    if (this.cargando) return this.cargando;

    this.cargando = this.cargar();
    try {
      return await this.cargando;
    } finally {
      this.cargando = null;
    }
  }

  // Llamado por SystemParamsService.actualizar() tras cada escritura
  // exitosa (create Y update) — la próxima lectura recarga desde la base en
  // vez de esperar el TTL, para que un cambio de umbral/consenso/asimetría
  // se refleje de inmediato en el próximo cálculo.
  invalidar(): void {
    this.cache = null;
    this.vencimiento = 0;
  }

  private async cargar(): Promise<Map<string, string>> {
    const filas = await this.prisma.systemParam.findMany();
    const mapa = new Map(filas.map((f) => [f.clave, f.valor]));
    this.cache = mapa;
    this.vencimiento = Date.now() + TTL_MS;
    return mapa;
  }
}
