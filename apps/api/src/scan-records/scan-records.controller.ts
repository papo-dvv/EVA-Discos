import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PreviewQueryDto } from '../migration/dto/preview-query.dto';
import { UpdateScanRecordDto } from './dto/update-scan-record.dto';
import { ValoresDistintosQueryDto } from './dto/valores-distintos-query.dto';
import { ScanRecordsService } from './scan-records.service';

// Vista permanente de mediciones confirmadas + edición/eliminación post-commit.
// Por ahora exclusivo del Administrador; los demás roles se habilitarán con la
// matriz de permisos completa en una etapa posterior.
@Controller('scan-records')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class ScanRecordsController {
  constructor(private readonly scanRecords: ScanRecordsService) {}

  @Get()
  buscar(@Query() query: PreviewQueryDto) {
    return this.scanRecords.buscar(query);
  }

  @Get('summary-by-tren')
  summaryByTren() {
    return this.scanRecords.obtenerResumenPorTren();
  }

  @Get('semaforo-mediciones')
  semaforoMediciones() {
    return this.scanRecords.obtenerSemaforoMediciones();
  }

  @Get('stats')
  stats(@Query() query: PreviewQueryDto) {
    return this.scanRecords.obtenerStats(query);
  }

  @Get('filtros')
  filtros() {
    return this.scanRecords.obtenerOpcionesFiltro();
  }

  @Get('valores-distintos')
  valoresDistintos(@Query() query: ValoresDistintosQueryDto) {
    return this.scanRecords.obtenerValoresDistintos(query.campo);
  }

  @Patch(':id')
  editar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateScanRecordDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.scanRecords.editar(id, dto, usuario.userId);
  }

  @Delete(':id')
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.scanRecords.eliminar(id, usuario.userId);
  }
}
