import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { EstadoCuenta } from '../../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

const BCRYPT_ROUNDS = 12;

export interface LoginResult {
  accessToken: string;
  forzarCambioPassword: boolean;
  usuario: {
    id: string;
    nombresCompletos: string;
    email: string;
    rol: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResult> {
    const usuario = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!usuario) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    // Sin importar la contraseña: el usuario "sistema" nunca puede loguearse.
    if (usuario.esUsuarioSistema) {
      throw new ForbiddenException('Esta cuenta no puede iniciar sesión.');
    }

    const passwordValida = await bcrypt.compare(
      dto.password,
      usuario.passwordHash,
    );
    if (!passwordValida) {
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    this.verificarEstadoCuenta(usuario.estadoCuenta);

    const payload: JwtPayload = {
      sub: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
    };
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      forzarCambioPassword: usuario.debeCambiarPassword,
      usuario: {
        id: usuario.id,
        nombresCompletos: usuario.nombresCompletos,
        email: usuario.email,
        rol: usuario.rol,
      },
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    const usuario = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!usuario) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // Fuente de verdad de la regla: reescribir la misma contraseña (ej. la
    // temporal) no cuenta como "cambiarla" — dejaría debe_cambiar_password en
    // false con la contraseña temporal intacta como definitiva.
    const igualALaActual = await bcrypt.compare(
      dto.newPassword,
      usuario.passwordHash,
    );
    if (igualALaActual) {
      throw new BadRequestException(
        'La nueva contraseña no puede ser igual a la actual.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, debeCambiarPassword: false },
    });

    return { message: 'Contraseña actualizada correctamente.' };
  }

  private verificarEstadoCuenta(estado: EstadoCuenta): void {
    switch (estado) {
      case 'activo':
        return;
      case 'pendiente_aprobacion':
        throw new ForbiddenException(
          'Tu cuenta está pendiente de aprobación. Te avisaremos cuando esté activa.',
        );
      case 'rechazado':
        throw new ForbiddenException('Tu solicitud de acceso fue rechazada.');
      case 'bloqueado':
        throw new ForbiddenException(
          'Tu cuenta está bloqueada. Contacta a un administrador.',
        );
    }
  }
}
