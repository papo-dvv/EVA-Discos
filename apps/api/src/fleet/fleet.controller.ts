import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FleetService } from './fleet.service';

@Controller('fleet')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  @Get('summary')
  summary() {
    return this.fleet.summary();
  }

  @Get(':tren/detalle')
  detalle(@Param('tren', ParseIntPipe) tren: number) {
    return this.fleet.detalle(tren);
  }

  @Get('disco/:codigoDisco/:lado/historico')
  historico(
    @Param('codigoDisco') codigoDisco: string,
    @Param('lado') lado: string,
  ) {
    return this.fleet.historicoDisco(codigoDisco, lado);
  }
}
