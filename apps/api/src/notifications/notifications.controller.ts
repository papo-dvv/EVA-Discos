import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { NotificationsService } from './notifications.service';

// Disponible para cualquier rol autenticado (una notificación puede ir
// dirigida a cualquier rolDestino, no es exclusivo de administrador) — el
// filtrado por usuario/rol vive en el service, no acá.
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.notificationsService.listarPropias(usuario.userId, usuario.rol);
  }
}
