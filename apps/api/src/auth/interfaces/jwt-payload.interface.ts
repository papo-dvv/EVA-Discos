import type { RolUsuario } from '../../../generated/prisma';

export type { RolUsuario };

export interface JwtPayload {
  sub: string;
  email: string;
  rol: RolUsuario;
}

// Lo que queda en `request.user` después de que JwtStrategy valida el token.
export interface AuthenticatedUser {
  userId: string;
  email: string;
  rol: RolUsuario;
}
