import { Injectable } from '@nestjs/common';
import type { RolUsuario } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';

// Alcance mínimo (solo lectura, sin marcar-leída ni conteo de no leídas):
// suficiente para que la campanita del frontend muestre las notificaciones
// del usuario, ej. consenso_extremo_ajustado (ver SystemParamsService).
const LIMITE_NOTIFICACIONES = 30;

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Una notificación es para el usuario puntual (userId) O para todo su rol
  // (rolDestino) — nunca hace falta desambiguar cuál de los dos, el OR cubre
  // ambos casos. Las más recientes primero, acotado: esto alimenta un panel
  // desplegable, no una bandeja paginada.
  async listarPropias(userId: string, rol: RolUsuario) {
    return this.prisma.notification.findMany({
      where: { OR: [{ userId }, { rolDestino: rol }] },
      orderBy: { createdAt: 'desc' },
      take: LIMITE_NOTIFICACIONES,
      select: {
        id: true,
        tipo: true,
        severidad: true,
        mensaje: true,
        createdAt: true,
      },
    });
  }
}
