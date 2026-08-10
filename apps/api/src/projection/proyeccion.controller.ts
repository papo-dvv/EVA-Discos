import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProyeccionDiscosQueryDto } from './dto/proyeccion-discos-query.dto';
import { ProyeccionPronosticoQueryDto } from './dto/proyeccion-pronostico-query.dto';
import { ProyeccionService } from './proyeccion.service';

// Proyección de Reperfilado y Cambio (wear_rate_pairs + última medición
// confirmada de scan_records). Mismo criterio de acceso que Trazabilidad y
// Tasa de Desgaste: exclusivo del Administrador.
@Controller('projection')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class ProyeccionController {
  constructor(private readonly proyeccion: ProyeccionService) {}

  @Get('discos')
  discos(@Query() query: ProyeccionDiscosQueryDto) {
    return this.proyeccion.listarDiscos(query);
  }

  @Get('promedio-por-vagon')
  promedioPorVagon() {
    return this.proyeccion.obtenerPromedioPorVagon();
  }

  @Get('pronostico-12-meses')
  pronostico12Meses(@Query() query: ProyeccionPronosticoQueryDto) {
    return this.proyeccion.obtenerPronostico12Meses(query);
  }
}
