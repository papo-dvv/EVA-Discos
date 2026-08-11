import { Module } from '@nestjs/common';
import { BrakeDiscRulesModule } from '../brake-disc-rules/brake-disc-rules.module';
import { WearRateModule } from '../wear-rate/wear-rate.module';
import { NewMeasurementCommitService } from './new-measurement-commit.service';
import { NewMeasurementPreviewService } from './new-measurement-preview.service';
import { NewMeasurementReferenceService } from './new-measurement-reference.service';
import { NewMeasurementValidationService } from './new-measurement-validation.service';
import { NewMeasurementController } from './new-measurement.controller';
import { NewMeasurementService } from './new-measurement.service';
import { ReprofilingPdfService } from './reprofiling-pdf.service';
import { ReprofilingGeminiService } from './reprofiling-gemini.service';

// WearRateModule: NewMeasurementCommitService lo usa para el recálculo
// incremental de Tasa de Desgaste tras confirmar (mismo enganche que
// MigrationModule con MigrationCommitService).
@Module({
  imports: [BrakeDiscRulesModule, WearRateModule],
  controllers: [NewMeasurementController],
  providers: [
    NewMeasurementService,
    NewMeasurementPreviewService,
    NewMeasurementCommitService,
    NewMeasurementValidationService,
    NewMeasurementReferenceService,
    ReprofilingGeminiService,
    ReprofilingPdfService,
  ],
})
export class NewMeasurementModule {}
