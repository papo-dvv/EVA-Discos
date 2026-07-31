import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { PreviewQueryDto } from './dto/preview-query.dto';
import { UpdateRowDto } from './dto/update-row.dto';
import { MigrationCommitService } from './migration-commit.service';
import { MigrationPreviewService } from './migration-preview.service';
import { MigrationService, type ResumenMigracion } from './migration.service';

const MAX_TAMANO_BYTES = 50 * 1024 * 1024; // ~50 MB

// Migración masiva del historial en Excel — exclusiva del Administrador.
@Controller('migration')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador')
export class MigrationController {
  constructor(
    private readonly migrationService: MigrationService,
    private readonly previewService: MigrationPreviewService,
    private readonly commitService: MigrationCommitService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_TAMANO_BYTES },
      fileFilter: (_req, file, cb) => {
        // Se valida por extensión (no por MIME): el mimetype del multipart es
        // poco fiable para .xlsm (suele llegar como application/vnd.ms-excel o
        // application/octet-stream). Se aceptan .xlsx y .xlsm — internamente son
        // el mismo contenedor OOXML; el .xlsm solo suma el proyecto de macros.
        const nombre = file.originalname.toLowerCase();
        if (!nombre.endsWith('.xlsx') && !nombre.endsWith('.xlsm')) {
          cb(
            new BadRequestException(
              'Solo se aceptan archivos Excel .xlsx o .xlsm.',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @UploadedFile() archivo: Express.Multer.File,
    @CurrentUser() usuario: AuthenticatedUser,
  ): Promise<ResumenMigracion> {
    return this.migrationService.procesarUpload(archivo, usuario.userId);
  }

  @Get(':fileId/preview')
  preview(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query() query: PreviewQueryDto,
  ) {
    return this.previewService.obtenerPreview(fileId, query);
  }

  @Get(':fileId/stats')
  stats(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Query() query: PreviewQueryDto,
  ) {
    return this.previewService.obtenerStats(fileId, query);
  }

  @Get(':fileId/filtros')
  filtros(@Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.previewService.obtenerOpcionesFiltro(fileId);
  }

  @Get(':fileId/summary-by-tren')
  summaryByTren(@Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.previewService.obtenerResumenPorTren(fileId);
  }

  @Patch(':fileId/rows/:rowId')
  editRow(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @Body() dto: UpdateRowDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.previewService.editarFila(fileId, rowId, dto, usuario.userId);
  }

  @Delete(':fileId/rows/:rowId')
  deleteRow(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Param('rowId', ParseUUIDPipe) rowId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.previewService.eliminarFila(fileId, rowId, usuario.userId);
  }

  @Delete(':fileId/tren/:numeroTren')
  deleteTren(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @Param('numeroTren', ParseIntPipe) numeroTren: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.previewService.eliminarTren(fileId, numeroTren, usuario.userId);
  }

  @Post(':fileId/commit')
  commit(
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.commitService.confirmar(fileId, usuario.userId);
  }

  @Delete(':fileId')
  cancelar(@Param('fileId', ParseUUIDPipe) fileId: string) {
    return this.commitService.cancelar(fileId);
  }
}
