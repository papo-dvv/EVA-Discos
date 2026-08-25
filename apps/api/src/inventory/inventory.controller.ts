import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InventoryQueryDto } from './dto/inventory-query.dto';
import { RegistrarDiscoDto } from './dto/registrar-disco.dto';
import { InventoryService } from './inventory.service';

@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // Lectura abierta a todos los roles autenticados de operación/análisis —
  // solo el alta y las escrituras de Operaciones (retiro masivo/cambio de
  // disco) quedan restringidas a los roles operativos.
  @Get()
  @Roles(
    'administrador',
    'supervisor',
    'tecnico_medicion',
    'operador_almacen',
    'tecnico_analisis',
    'auditor',
  )
  listar(@Query() query: InventoryQueryDto) {
    return this.inventory.listar(query);
  }

  @Get('stats')
  @Roles(
    'administrador',
    'supervisor',
    'tecnico_medicion',
    'operador_almacen',
    'tecnico_analisis',
    'auditor',
  )
  stats() {
    return this.inventory.obtenerStats();
  }

  @Post()
  @Roles('administrador', 'supervisor', 'tecnico_medicion', 'operador_almacen')
  registrar(@Body() dto: RegistrarDiscoDto) {
    return this.inventory.registrar(dto);
  }
}
