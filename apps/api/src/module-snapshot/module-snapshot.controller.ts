import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ModuleSnapshotQueryDto } from './dto/module-snapshot-query.dto';
import { GenerarSnapshotService } from './generar-snapshot.service';

// Solo lectura por ahora: el botón de "actualizar manualmente" todavía no
// existe (ver GenerarSnapshotService) — este endpoint únicamente expone el
// último snapshot ya generado (hoy siempre automático), para que el
// frontend pueda mostrar "Última actualización: [fecha]" desde ya. Mismo
// criterio de acceso que Trazabilidad/Proyección: exclusivo del
// Administrador.
@Controller('module-snapshot')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class ModuleSnapshotController {
  constructor(private readonly generarSnapshot: GenerarSnapshotService) {}

  @Get('last')
  last(@Query() query: ModuleSnapshotQueryDto) {
    return this.generarSnapshot.obtenerUltimo(query.modulo);
  }
}
