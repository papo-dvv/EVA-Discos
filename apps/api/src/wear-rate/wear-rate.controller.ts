import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { WearRateChartQueryDto } from './dto/wear-rate-chart-query.dto';
import { WearRatePairsQueryDto } from './dto/wear-rate-pairs-query.dto';
import { WearRateSummaryQueryDto } from './dto/wear-rate-summary-query.dto';
import { WearRateService } from './wear-rate.service';

// Tasa de desgaste de discos de freno (tabla precomputada wear_rate_pairs).
// Por ahora exclusivo del Administrador, mismo criterio que scan-records.
@Controller('wear-rate')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class WearRateController {
  constructor(private readonly wearRate: WearRateService) {}

  @Get('pairs')
  pairs(@Query() query: WearRatePairsQueryDto) {
    return this.wearRate.buscarPares(query);
  }

  @Get('chart')
  chart(@Query() query: WearRateChartQueryDto) {
    return this.wearRate.obtenerChart(query);
  }

  @Get('chart-por-coche')
  chartPorCoche() {
    return this.wearRate.obtenerChartPorTipoCoche();
  }

  @Get('summary')
  summary(@Query() query: WearRateSummaryQueryDto) {
    return this.wearRate.obtenerSummary(query);
  }
}
