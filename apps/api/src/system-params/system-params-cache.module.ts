import { Global, Module } from '@nestjs/common';
import { SystemParamsCacheService } from './system-params-cache.service';

// Global (mismo criterio que PrismaModule) para que cualquier módulo pueda
// inyectar el singleton de caché sin arrastrar un import cruzado explícito
// (BrakeDiscRulesModule, TraceabilityModule y ProjectionModule cada uno
// declara su propia instancia de los servicios de config que lo consumen —
// ver comentarios en esos *.module.ts —, así que sin @Global() cada uno
// terminaría con su propio caché aislado, y SystemParamsService.actualizar()
// no podría invalidarlos a todos con un solo invalidar()).
@Global()
@Module({
  providers: [SystemParamsCacheService],
  exports: [SystemParamsCacheService],
})
export class SystemParamsCacheModule {}
