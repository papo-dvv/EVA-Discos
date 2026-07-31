import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { UpdateSystemParamDto } from './dto/update-system-param.dto';
import { SystemParamsService } from './system-params.service';

// Parámetros del sistema (umbrales de negocio, método de outlier, etc.).
// Editar un parámetro es exclusivo del Administrador.
@Controller('system-params')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class SystemParamsController {
  constructor(private readonly systemParamsService: SystemParamsService) {}

  @Get()
  listar() {
    return this.systemParamsService.listar();
  }

  @Patch(':clave')
  actualizar(
    @Param('clave') clave: string,
    @Body() dto: UpdateSystemParamDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.systemParamsService.actualizar(
      clave,
      dto.valor,
      usuario.userId,
    );
  }
}
