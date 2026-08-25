import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Prisma, SystemParam } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { esClavePercentil } from '../traceability/consenso-config.service';
import {
  ConsensoValidationService,
  type AjusteExtremo,
} from '../traceability/consenso-validation.service';
import {
  PARAMS_EDITABLES,
  PARAMS_INICIALES_FALTANTES,
  validarValorParam,
} from './system-params.config';

// ajustesConsenso viaja SIEMPRE en la respuesta 200 (array vacío si la Regla B
// no aplicó) — así el frontend distingue "guardado limpio" de "guardado con
// ajuste automático" sin tener que consultar las notificaciones aparte (ver
// PanelParametros.tsx: aviso inline cuando ajustesConsenso.length > 0).
export type SystemParamActualizado = SystemParam & {
  ajustesConsenso: AjusteExtremo[];
};

const MENSAJE_RECHAZO_AMPLITUD =
  'Alerta: este cambio produce que la amplitud de los límites supere los ' +
  '0.25 permitidos. Valores de Límite y Amplitud del consenso no admitido. ' +
  'Pruebe con otros valores.';

@Injectable()
export class SystemParamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consensoValidation: ConsensoValidationService,
  ) {}

  // Lista todos los parámetros ordenados por clave, marcando cuáles son
  // editables (según PARAMS_EDITABLES) para que el frontend sepa cuáles
  // exponer con input inline.
  async listar() {
    const params = await this.prisma.systemParam.findMany({
      orderBy: { clave: 'asc' },
    });
    const existentes = new Set(params.map((p) => p.clave));
    const faltantes = Object.entries(PARAMS_INICIALES_FALTANTES)
      .filter(([clave]) => !existentes.has(clave))
      .map(([clave, parametro]) => ({
        clave,
        valor: parametro.valor,
        descripcion: parametro.descripcion,
        actualizadoEn: null,
      }));

    return [...params, ...faltantes]
      .sort((a, b) => a.clave.localeCompare(b.clave))
      .map((p) => ({
        clave: p.clave,
        valor: p.valor,
        descripcion: p.descripcion,
        actualizadoEn: p.actualizadoEn,
        editable: PARAMS_EDITABLES[p.clave] !== undefined,
      }));
  }

  async actualizar(
    clave: string,
    valor: string,
    usuarioId: string,
  ): Promise<SystemParamActualizado> {
    const regla = PARAMS_EDITABLES[clave];
    if (!regla) {
      throw new NotFoundException(
        `El parámetro «${clave}» no existe o no es configurable.`,
      );
    }

    const validacion = validarValorParam(valor, regla);
    if (!validacion.ok) {
      throw new BadRequestException(validacion.motivo);
    }
    const valorNuevo = validacion.valor;

    const actual = await this.prisma.systemParam.findUnique({
      where: { clave },
    });
    const inicial = PARAMS_INICIALES_FALTANTES[clave];
    if (!actual && !inicial) {
      throw new NotFoundException(`El parámetro «${clave}» no existe.`);
    }

    if (!actual) {
      return this.prisma.$transaction(async (tx) => {
        const creado = await tx.systemParam.create({
          data: {
            clave,
            valor: valorNuevo,
            descripcion: inicial.descripcion,
            actualizadoPor: usuarioId,
            actualizadoEn: new Date(),
          },
        });
        await tx.systemParamAudit.create({
          data: { clave, valorAnterior: inicial.valor, valorNuevo, usuarioId },
        });
        return { ...creado, ajustesConsenso: [] };
      });
    }

    // Los 4 parámetros de percentil (únicos configurables de los 3 métodos)
    // recalculan el consenso resultante para TODAS las combinaciones de
    // scope con datos suficientes ANTES de persistir — ver
    // ConsensoValidationService. Cualquier otra clave (incluida
    // consenso_extremo_epsilon) sigue el camino de siempre, sin este paso.
    const notificacionesAjuste: Prisma.NotificationCreateManyInput[] = [];
    let ajustesConsenso: AjusteExtremo[] = [];
    if (esClavePercentil(clave)) {
      const validacionConsenso =
        await this.consensoValidation.validarCambioPercentil(clave, valorNuevo);
      if (validacionConsenso.tipo === 'rechazado') {
        throw new UnprocessableEntityException({
          message: MENSAJE_RECHAZO_AMPLITUD,
          combinaciones: validacionConsenso.combinaciones,
        });
      }
      ajustesConsenso = validacionConsenso.ajustes;
      for (const ajuste of ajustesConsenso) {
        notificacionesAjuste.push({
          tipo: 'consenso_extremo_ajustado',
          severidad: 'advertencia',
          rolDestino: 'administrador',
          mensaje:
            `Consenso ajustado para ${ajuste.scope}: el extremo inferior ` +
            `calculado (${ajuste.valorOriginal.toFixed(6)}) no puede ser <= 0 ` +
            `y se corrigió a ${ajuste.epsilonAplicado}.`,
        });
      }
    }

    // Actualización + auditoría (+ notificaciones de ajuste, si aplica) en
    // una transacción. La auditoría se registra solo cuando el valor cambia
    // realmente (un PATCH con el mismo valor no ensucia el historial);
    // actualizado_por/actualizado_en sí se refrescan siempre para dejar
    // constancia de quién lo revisó por última vez.
    return this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.systemParam.update({
        where: { clave },
        data: {
          valor: valorNuevo,
          actualizadoPor: usuarioId,
          actualizadoEn: new Date(),
        },
      });

      if (actual.valor !== valorNuevo) {
        await tx.systemParamAudit.create({
          data: {
            clave,
            valorAnterior: actual.valor,
            valorNuevo,
            usuarioId,
          },
        });
      }

      if (notificacionesAjuste.length > 0) {
        await tx.notification.createMany({ data: notificacionesAjuste });
      }

      return { ...actualizado, ajustesConsenso };
    });
  }
}
