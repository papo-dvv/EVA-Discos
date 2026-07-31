import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type {
  AuthenticatedUser,
  RolUsuario,
} from '../interfaces/jwt-payload.interface';

// Se aplica DESPUÉS de JwtAuthGuard (@UseGuards(JwtAuthGuard, RolesGuard)):
// lee request.user, que JwtAuthGuard/JwtStrategy ya deben haber poblado.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<
      RolUsuario[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const usuario = request.user;

    if (!usuario || !rolesPermitidos.includes(usuario.rol)) {
      throw new ForbiddenException(
        'No tienes permisos para acceder a este recurso.',
      );
    }

    return true;
  }
}
