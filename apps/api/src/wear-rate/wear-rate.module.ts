import { Module } from '@nestjs/common';
import { BrakeDiscRulesModule } from '../brake-disc-rules/brake-disc-rules.module';
import { WearRateCalculatorService } from './wear-rate-calculator.service';
import { WearRateController } from './wear-rate.controller';
import { WearRateService } from './wear-rate.service';

@Module({
  // BrakeDiscRulesModule: WearRateService lo usa para traducir estado[] a un
  // rango de rd2 y para resolver accionRecomendada (ver buscarPares).
  imports: [BrakeDiscRulesModule],
  controllers: [WearRateController],
  providers: [WearRateService, WearRateCalculatorService],
  // Exportado para que MigrationModule pueda enganchar el recálculo
  // incremental desde MigrationCommitService tras resolver disc_id por lote.
  exports: [WearRateService],
})
export class WearRateModule {}
