import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { DevolverAlmacenDto } from './dto/devolver-almacen.dto';
import { EditarEjeDto } from './dto/editar-eje.dto';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { RegistrarEjeDto } from './dto/registrar-eje.dto';
import { InventoryService } from './inventory.service';

const ROLES_LECTURA = [
  'administrador',
  'supervisor',
  'tecnico_medicion',
  'operador_almacen',
  'tecnico_analisis',
  'auditor',
] as const;
const ROLES_ESCRITURA = [
  'administrador',
  'supervisor',
  'tecnico_medicion',
  'operador_almacen',
] as const;

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Lectura abierta a todos los roles autenticados de operación/análisis —
  // solo el alta/edición/borrado quedan restringidos a los roles operativos.
  @Get()
  @Roles(...ROLES_LECTURA)
  listar(@Query() query: InventoryQueryDto) {
    return this.inventory.listar(query);
  }

  @Get('stats')
  @Roles(...ROLES_LECTURA)
  stats() {
    return this.inventory.obtenerStats();
  }

  @Get('retiros-por-mes')
  @Roles(...ROLES_LECTURA)
  retirosPorMes() {
    return this.inventory.obtenerRetirosPorMes();
  }

  @Get('cambios-disco-anio')
  @Roles(...ROLES_LECTURA)
  cambiosDiscoAnio() {
    return this.inventory.obtenerCambiosDiscoAnio();
  }

  @Get('cambios-reales-por-mes')
  @Roles(...ROLES_LECTURA)
  cambiosRealesPorMes() {
    return this.inventory.obtenerCambiosRealesPorMes();
  }

  @Post()
  @Roles(...ROLES_ESCRITURA)
  registrar(@Body() dto: RegistrarEjeDto) {
    return this.inventory.registrarEje(dto);
  }

  @Patch(':serie')
  @Roles(...ROLES_ESCRITURA)
  editar(@Param('serie') serie: string, @Body() dto: EditarEjeDto) {
    return this.inventory.editarEje(serie, dto);
  }

  @Delete(':serie')
  @Roles(...ROLES_ESCRITURA)
  eliminar(@Param('serie') serie: string) {
    return this.inventory.eliminarEje(serie);
  }

  // Taller -> Almacén, exclusivo de Inventario (distinto de Retiro Masivo en
  // Operaciones, que va Almacén -> Taller).
  @Post('devolver-almacen')
  @Roles(...ROLES_ESCRITURA)
  devolverAlmacen(
    @Body() dto: DevolverAlmacenDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.inventory.devolverAlmacen(dto, user.userId);
  }
}
