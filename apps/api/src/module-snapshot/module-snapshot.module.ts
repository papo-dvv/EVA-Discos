import { Module } from '@nestjs/common';
import { ProjectionModule } from '../projection/projection.module';
import { TraceabilityModule } from '../traceability/traceability.module';
import { GenerarSnapshotService } from './generar-snapshot.service';
import { ModuleSnapshotController } from './module-snapshot.controller';
import { SnapshotBootstrapService } from './snapshot-bootstrap.service';

@Module({
  // TraceabilityModule/ProjectionModule exportan TraceabilityService/
  // ProyeccionService puntualmente para esto (ver los comentarios en cada
  // módulo) — reusa exactamente el mismo cálculo que ve cada pantalla, sin
  // reconstruir su árbol de dependencias como providers propios acá.
  imports: [TraceabilityModule, ProjectionModule],
  controllers: [ModuleSnapshotController],
  providers: [GenerarSnapshotService, SnapshotBootstrapService],
  // Exportado para que MigrationModule pueda enganchar la generación
  // automática del snapshot tras el primer commit exitoso de la migración
  // masiva (ver MigrationCommitService.confirmar) — la otra mitad de "lo que
  // ocurra primero" junto con SnapshotBootstrapService.
  exports: [GenerarSnapshotService],
})
export class ModuleSnapshotModule {}
