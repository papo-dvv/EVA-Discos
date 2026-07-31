import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt');
const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>;

type MockUser = {
  id: string;
  nombresCompletos: string;
  email: string;
  passwordHash: string;
  rol: string;
  estadoCuenta: string;
  debeCambiarPassword: boolean;
  esUsuarioSistema: boolean;
};

function buildUser(overrides: Partial<MockUser> = {}): MockUser {
  return {
    id: 'user-1',
    nombresCompletos: 'Administrador EVA',
    email: 'admin@eva-l1.local',
    passwordHash: 'hash-guardado',
    rol: 'administrador',
    estadoCuenta: 'activo',
    debeCambiarPassword: false,
    esUsuarioSistema: false,
    ...overrides,
  };
}

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock };
  };
  let jwtService: { signAsync: jest.Mock };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn(), update: jest.fn() } };
    jwtService = { signAsync: jest.fn().mockResolvedValue('token-firmado') };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    authService = moduleRef.get(AuthService);
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('inicia sesión con credenciales válidas y cuenta activa', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      bcryptMock.compare.mockResolvedValue(true as never);

      const resultado = await authService.login({
        email: 'admin@eva-l1.local',
        password: 'Eva#L1nea2026!',
      });

      expect(resultado.accessToken).toBe('token-firmado');
      expect(resultado.forzarCambioPassword).toBe(false);
      expect(resultado.usuario.email).toBe('admin@eva-l1.local');
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'admin@eva-l1.local',
        rol: 'administrador',
      });
    });

    it('rechaza con 403 al usuario "sistema", sin importar la contraseña', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ esUsuarioSistema: true }),
      );

      await expect(
        authService.login({
          email: 'sistema@eva-l1.local',
          password: 'cualquier-cosa',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);

      // La contraseña ni siquiera se llega a comparar.
      expect(bcryptMock.compare).not.toHaveBeenCalled();
    });

    it('rechaza credenciales inválidas cuando el usuario no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.login({ email: 'nadie@eva-l1.local', password: 'x' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rechaza credenciales inválidas cuando la contraseña no coincide', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      bcryptMock.compare.mockResolvedValue(false as never);

      await expect(
        authService.login({
          email: 'admin@eva-l1.local',
          password: 'incorrecta',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it.each([['pendiente_aprobacion'], ['rechazado'], ['bloqueado']])(
      'rechaza el login cuando estado_cuenta es "%s"',
      async (estadoCuenta) => {
        prisma.user.findUnique.mockResolvedValue(buildUser({ estadoCuenta }));
        bcryptMock.compare.mockResolvedValue(true as never);

        await expect(
          authService.login({
            email: 'admin@eva-l1.local',
            password: 'Eva#L1nea2026!',
          }),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );

    it('incluye forzarCambioPassword=true cuando debe_cambiar_password está activo', async () => {
      prisma.user.findUnique.mockResolvedValue(
        buildUser({ debeCambiarPassword: true }),
      );
      bcryptMock.compare.mockResolvedValue(true as never);

      const resultado = await authService.login({
        email: 'admin@eva-l1.local',
        password: 'Eva#L1nea2026!',
      });

      expect(resultado.forzarCambioPassword).toBe(true);
      // El login se completa igual: se emite token pese al flag.
      expect(resultado.accessToken).toBe('token-firmado');
    });
  });

  describe('changePassword', () => {
    it('hashea la nueva contraseña y apaga debe_cambiar_password', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      bcryptMock.compare.mockResolvedValue(false as never);
      bcryptMock.hash.mockResolvedValue('nuevo-hash' as never);
      prisma.user.update.mockResolvedValue(
        buildUser({ debeCambiarPassword: false }),
      );

      const resultado = await authService.changePassword('user-1', {
        newPassword: 'NuevaClave123',
      });

      expect(bcryptMock.compare).toHaveBeenCalledWith(
        'NuevaClave123',
        'hash-guardado',
      );
      expect(bcryptMock.hash).toHaveBeenCalledWith('NuevaClave123', 12);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'nuevo-hash', debeCambiarPassword: false },
      });
      expect(resultado.message).toBeDefined();
    });

    it('rechaza con 400 si la nueva contraseña es igual a la actual, sin tocar la base', async () => {
      prisma.user.findUnique.mockResolvedValue(buildUser());
      bcryptMock.compare.mockResolvedValue(true as never);

      await expect(
        authService.changePassword('user-1', {
          newPassword: 'Eva#L1nea2026!',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(bcryptMock.hash).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('lanza NotFound si el usuario del JWT ya no existe', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.changePassword('user-inexistente', {
          newPassword: 'NuevaClave123',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });
});
