import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { HistorialQueryDto } from './dto/historial-query.dto';
import { HistorialService } from './historial.service';

const ROLES_LECTURA = [
  'administrador',
  'supervisor',
  'tecnico_medicion',
  'operador_almacen',
  'tecnico_analisis',
  'auditor',
] as const;

@Controller('historial')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ROLES_LECTURA)
export class HistorialController {
  constructor(private readonly historial: HistorialService) {}

  // Registrado ANTES de cualquier ruta con parámetro (hoy no hay ninguna,
  // pero se deja el comentario por si se agrega ':id' más adelante — mismo
  // motivo de orden de rutas que en otros controllers de este proyecto).
  @Get('kpis')
  kpis(@Query() query: HistorialQueryDto) {
    return this.historial.kpis({
      desde: query.desde,
      hasta: query.hasta,
      tren: query.tren,
    });
  }

  @Get()
  listar(@Query() query: HistorialQueryDto) {
    return this.historial.listar({
      tipo: query.tipo,
      desde: query.desde,
      hasta: query.hasta,
      tren: query.tren,
      limit: query.limit,
    });
  }
}
