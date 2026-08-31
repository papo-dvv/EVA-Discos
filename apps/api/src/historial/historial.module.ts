import { Module } from '@nestjs/common';
import { NewMeasurementHistoryService } from '../new-measurement/new-measurement-history.service';
import { HistorialController } from './historial.controller';
import { HistorialService } from './historial.service';

// NewMeasurementHistoryService como provider propio (no exportado por
// NewMeasurementModule) — mismo patrón que WearRateModule con
// TraceabilityStatsService/ConsensoConfigService: solo depende de
// PrismaService, así que declararlo acá no duplica estado real.
@Module({
  controllers: [HistorialController],
  providers: [HistorialService, NewMeasurementHistoryService],
})
export class HistorialModule {}
