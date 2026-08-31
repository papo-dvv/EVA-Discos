import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ModeloTren } from '../../generated/prisma';
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

  // Registrado ANTES de ':tren/detalle' a propósito, mismo motivo de orden de
  // rutas que new-measurement.controller.ts: si quedara después, Nest
  // intentaría matchear "trenes-criticos-resumen" contra ':tren' (ParseIntPipe
  // fallaría con 400). Card de Trenes Críticos del dashboard.
  @Get('trenes-criticos-resumen')
  trenesCriticosResumen(@Query('fabricante') fabricante?: ModeloTren) {
    return this.fleet.resumenTrenesCriticos(fabricante);
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
