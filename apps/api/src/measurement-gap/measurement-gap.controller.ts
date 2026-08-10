import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { MeasurementGapQueryDto } from './dto/measurement-gap-query.dto';
import { MeasurementGapService } from './measurement-gap.service';

// Alerta de "hace cuánto no se mide" cada disco. Mismo criterio de acceso que
// el resto de módulos de datos: exclusivo del Administrador por ahora.
@Controller('measurement-gap')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class MeasurementGapController {
  constructor(private readonly measurementGap: MeasurementGapService) {}

  @Get('summary')
  summary(@Query() query: MeasurementGapQueryDto) {
    return this.measurementGap.obtenerSummary(query.umbralMeses);
  }
}
