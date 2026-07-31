import { Module } from '@nestjs/common';
import { BrakeDiscRulesService } from './brake-disc-rules.service';
import { UmbralesProviderService } from './umbrales-provider.service';

@Module({
  providers: [BrakeDiscRulesService, UmbralesProviderService],
  exports: [BrakeDiscRulesService],
})
export class BrakeDiscRulesModule {}
