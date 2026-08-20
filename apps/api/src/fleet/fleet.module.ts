import { Module } from '@nestjs/common';
import { BrakeDiscRulesModule } from '../brake-disc-rules/brake-disc-rules.module';
import { FleetController } from './fleet.controller';
import { FleetService } from './fleet.service';
import { ResolverCodigoDiscoService } from './resolver-codigo-disco.service';

@Module({
  imports: [BrakeDiscRulesModule],
  controllers: [FleetController],
  providers: [FleetService, ResolverCodigoDiscoService],
  exports: [FleetService, ResolverCodigoDiscoService],
})
export class FleetModule {}
