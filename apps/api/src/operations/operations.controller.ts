import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { FleetService } from '../fleet/fleet.service';
import { CambioDiscoDto } from './dto/cambio-disco.dto';
import { RetiroMasivoDto } from './dto/retiro-masivo.dto';
import { OperationsCambioDiscoService } from './operations-cambio-disco.service';
import { OperationsRetiroMasivoService } from './operations-retiro-masivo.service';

const ROLES_OPERACIONES = [
  'administrador',
  'supervisor',
  'tecnico_medicion',
  'operador_almacen',
] as const;

@Controller('operations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_OPERACIONES)
export class OperationsController {
  constructor(
    private readonly retiroMasivo: OperationsRetiroMasivoService,
    private readonly cambioDisco: OperationsCambioDiscoService,
    // Reexpone FleetService.detalle bajo el gate de roles de Operaciones: el
    // diagrama de coche/bogie/eje que necesita Cambio de Disco es el mismo
    // dato que ya sirve /fleet/:tren/detalle, pero FleetController está
    // restringido a administrador — acá se reusa el servicio sin duplicar la
    // consulta ni aflojar el acceso de Flota.
    private readonly fleet: FleetService,
  ) {}

  @Get('tren/:trenNumero/detalle')
  detalleTren(@Param('trenNumero', ParseIntPipe) trenNumero: number) {
    return this.fleet.detalle(trenNumero);
  }

  @Post('retiro-masivo')
  retirar(
    @Body() dto: RetiroMasivoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.retiroMasivo.retirar(dto, usuario.userId);
  }

  @Post('cambio-disco')
  cambiar(
    @Body() dto: CambioDiscoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.cambioDisco.cambiar(dto, usuario.userId);
  }
}
