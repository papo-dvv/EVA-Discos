import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { RolesGuard } from './roles.guard';

function buildContext(user: AuthenticatedUser | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  const admin: AuthenticatedUser = {
    userId: 'u1',
    email: 'admin@eva-l1.local',
    rol: 'administrador',
  };
  const tecnico: AuthenticatedUser = {
    userId: 'u2',
    email: 'tecnico@eva-l1.local',
    rol: 'tecnico_medicion',
  };

  it('permite el acceso cuando la ruta no declara @Roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(buildContext(tecnico))).toBe(true);
  });

  it('permite el acceso cuando el rol del usuario está en la lista permitida', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['administrador']);

    expect(guard.canActivate(buildContext(admin))).toBe(true);
  });

  it('deniega el acceso cuando el rol del usuario no está permitido', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['administrador']);

    expect(() => guard.canActivate(buildContext(tecnico))).toThrow(
      ForbiddenException,
    );
  });

  it('deniega el acceso cuando no hay usuario en el request', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['administrador']);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
