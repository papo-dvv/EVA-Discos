import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Claves exactas de system_params.clave (ver prisma/seed.ts) — mismo
// criterio que CLAVE_UMBRAL_MESES (measurement-gap/measurement-gap-config.service.ts).
export const CLAVE_DIAS_SEMAFORO_ALERTA = 'dias_semaforo_alerta';
export const CLAVE_DIAS_SEMAFORO_CRITICO = 'dias_semaforo_critico';
export const CLAVE_DIAS_SEMAFORO_PRIORIDAD = 'dias_semaforo_prioridad';

const POR_DEFECTO = { alerta: 16, critico: 26, prioridad: 31 };

export interface UmbralesSemaforoMediciones {
  alerta: number;
  critico: number;
  prioridad: number;
}

export type EstadoSemaforoMediciones =
  'NORMAL' | 'ALERTA' | 'CRITICO' | 'PRIORIDAD';

// Clasifica días sin medir contra los umbrales (chequeo de mayor a menor,
// gana el primer nivel que aplica). null (tren nunca medido) siempre es
// PRIORIDAD — el peor caso posible, no un default silencioso.
export function clasificarSemaforoMediciones(
  diasSinMedir: number | null,
  umbrales: UmbralesSemaforoMediciones,
): EstadoSemaforoMediciones {
  if (diasSinMedir === null) return 'PRIORIDAD';
  if (diasSinMedir >= umbrales.prioridad) return 'PRIORIDAD';
  if (diasSinMedir >= umbrales.critico) return 'CRITICO';
  if (diasSinMedir >= umbrales.alerta) return 'ALERTA';
  return 'NORMAL';
}

// Resuelve los umbrales (en días sin medir) del semáforo de Mediciones desde
// system_params, con fallback si la fila todavía no existe o su valor no es
// numérico — mismo patrón que MeasurementGapConfigService.
@Injectable()
export class MedicionesSemaforoConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async obtenerUmbrales(): Promise<UmbralesSemaforoMediciones> {
    const filas = await this.prisma.systemParam.findMany({
      where: {
        clave: {
          in: [
            CLAVE_DIAS_SEMAFORO_ALERTA,
            CLAVE_DIAS_SEMAFORO_CRITICO,
            CLAVE_DIAS_SEMAFORO_PRIORIDAD,
          ],
        },
      },
    });
    const porClave = new Map(filas.map((f) => [f.clave, f.valor]));

    const leer = (clave: string, porDefecto: number): number => {
      const valor = porClave.get(clave);
      if (valor === undefined) return porDefecto;
      const numero = Number(valor);
      return Number.isFinite(numero) ? numero : porDefecto;
    };

    return {
      alerta: leer(CLAVE_DIAS_SEMAFORO_ALERTA, POR_DEFECTO.alerta),
      critico: leer(CLAVE_DIAS_SEMAFORO_CRITICO, POR_DEFECTO.critico),
      prioridad: leer(CLAVE_DIAS_SEMAFORO_PRIORIDAD, POR_DEFECTO.prioridad),
    };
  }
}
