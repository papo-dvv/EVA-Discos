import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FleetCompletenessDetalleQueryDto } from './dto/fleet-completeness-detalle-query.dto';
import { FleetCompletenessService } from './fleet-completeness.service';

// Completitud del catálogo de flota esperada (wagon_units/brake_discs)
// contra el historial de mediciones confirmadas. Mismo criterio de acceso
// que el resto de módulos de datos: exclusivo del Administrador por ahora.
@Controller('fleet-completeness')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class FleetCompletenessController {
  constructor(private readonly fleetCompleteness: FleetCompletenessService) {}

  @Get('summary')
  summary() {
    return this.fleetCompleteness.obtenerSummary();
  }

  @Get('detalle')
  detalle(@Query() query: FleetCompletenessDetalleQueryDto) {
    return this.fleetCompleteness.obtenerDetalle(query.tren);
  }
}
