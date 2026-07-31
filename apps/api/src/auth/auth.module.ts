import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        // @nestjs/jwt tipa expiresIn con el StringValue "de marca" del paquete
        // `ms` (ej. "8h"), que un string dinámico leído del env nunca satisface
        // estructuralmente aunque el valor sea válido en runtime.
        const expiresIn = (config.get<string>('JWT_EXPIRES_IN') ??
          '8h') as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];

        return {
          secret: config.getOrThrow<string>('JWT_SECRET'),
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
