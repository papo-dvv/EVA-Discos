import { Module } from '@nestjs/common';
import { BrakeDiscRulesModule } from '../brake-disc-rules/brake-disc-rules.module';
import { ConsensoConfigService } from '../traceability/consenso-config.service';
import { TraceabilityStatsService } from '../traceability/traceability-stats.service';
import { WearRateCalculatorService } from './wear-rate-calculator.service';
import { WearRateController } from './wear-rate.controller';
import { WearRateService } from './wear-rate.service';

@Module({
  // BrakeDiscRulesModule: WearRateService lo usa para traducir estado[] a un
  // rango de rd2 y para resolver accionRecomendada (ver buscarPares).
  imports: [BrakeDiscRulesModule],
  controllers: [WearRateController],
  // TraceabilityStatsService/ConsensoConfigService: servicios puros / solo-
  // Prisma sin estado propio, declarados como providers propios en vez de
  // importar TraceabilityModule entero (que no los exporta) — mismo criterio
  // que ya usa ProjectionModule para el consenso Gauss∩Percentiles∩Tukey
  // (ver WearRateService.promedioLimpio).
  providers: [
    WearRateService,
    WearRateCalculatorService,
    TraceabilityStatsService,
    ConsensoConfigService,
  ],
  // Exportado para que MigrationModule pueda enganchar el recálculo
  // incremental desde MigrationCommitService tras resolver disc_id por lote.
  exports: [WearRateService],
})
export class WearRateModule {}
