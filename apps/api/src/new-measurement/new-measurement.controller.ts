import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  Res,
  StreamableFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import type { Response } from 'express';
import { PreviewQueryDto } from '../migration/dto/preview-query.dto';
import { AgregarFilaDto } from './dto/agregar-fila.dto';
import { CrearManualDto } from './dto/crear-manual.dto';
import { ReferenceQueryDto } from './dto/reference-query.dto';
import { UpdateFichaDto } from './dto/update-ficha.dto';
import { UpdateFilaDto } from './dto/update-fila.dto';
import { UploadCsvDto } from './dto/upload-csv.dto';
import { NewMeasurementCommitService } from './new-measurement-commit.service';
import { NewMeasurementPreviewService } from './new-measurement-preview.service';
import { NewMeasurementReferenceService } from './new-measurement-reference.service';
import { NewMeasurementValidationService } from './new-measurement-validation.service';
import { NewMeasurementService } from './new-measurement.service';
import { ReprofilingGeminiService } from './reprofiling-gemini.service';
import { ReprofilingPdfService } from './reprofiling-pdf.service';

const MAX_TAMANO_BYTES = 10 * 1024 * 1024; // ~10 MB — CSV de una ficha, nunca miles de filas como la migración

// Ficha de medición individual (motivo 'Medición' únicamente por ahora) —
// carga de CSV de Nextsense/cpo o ingreso 100% manual. Igual criterio de
// roles que el resto de módulos de captura: el técnico de medición es quien
// opera esto en campo, con supervisor/administrador como roles de respaldo.
@Controller('new-measurement')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('administrador', 'supervisor', 'tecnico_medicion')
export class NewMeasurementController {
  constructor(
    private readonly service: NewMeasurementService,
    private readonly previewService: NewMeasurementPreviewService,
    private readonly commitService: NewMeasurementCommitService,
    private readonly validationService: NewMeasurementValidationService,
    private readonly referenceService: NewMeasurementReferenceService,
    private readonly reprofilingGeminiService: ReprofilingGeminiService,
    private readonly reprofilingPdfService: ReprofilingPdfService,
  ) {}

  // Registrado ANTES de ':fichaId' a propósito: si quedara después, Nest
  // matchearía GET /new-measurement/reference contra ':fichaId' primero (el
  // segmento "reference" fallaría ParseUUIDPipe con un 400 en vez de resolver
  // esta ruta).
  @Get('reference')
  referencia(@Query() query: ReferenceQueryDto) {
    return this.referenceService.obtener(query.tren, query.tipo);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_TAMANO_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.toLowerCase().endsWith('.csv')) {
          cb(new BadRequestException('Solo se acepta un archivo .csv.'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  upload(
    @UploadedFile() archivo: Express.Multer.File,
    @Body() dto: UploadCsvDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.service.subirCsv(archivo, dto, usuario.userId);
  }

  @Post('manual')
  crearManual(
    @Body() dto: CrearManualDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.service.crearManual(dto, usuario.userId);
  }

  @Post('reprofiling/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_TAMANO_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.mimetype)) {
          cb(
            new BadRequestException(
              'Solo se acepta una fotografía JPG, PNG, WEBP o HEIC.',
            ),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  leerFotoReperfilado(@UploadedFile() archivo: Express.Multer.File) {
    return this.reprofilingGeminiService.leer(archivo);
  }

  @Get(':fichaId/reprofiling/pdf')
  async descargarPdfReperfilado(
    @Param('fichaId', ParseUUIDPipe) fichaId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const pdf = await this.reprofilingPdfService.generar(fichaId);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="reperfilado-${fichaId}.pdf"`,
    );
    return new StreamableFile(Buffer.from(pdf));
  }

  @Post(':fichaId/reprofiling')
  crearReperfiladoDesdeMedicion(
    @Param('fichaId', ParseUUIDPipe) fichaId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.service.crearReperfiladoDesdeMedicion(fichaId, usuario.userId);
  }

  @Get(':fichaId')
  obtenerFicha(@Param('fichaId', ParseUUIDPipe) fichaId: string) {
    return this.previewService.obtenerFicha(fichaId);
  }

  @Get(':fichaId/preview')
  preview(
    @Param('fichaId', ParseUUIDPipe) fichaId: string,
    @Query() query: PreviewQueryDto,
  ) {
    return this.previewService.obtenerPreview(fichaId, query);
  }

  @Patch(':fichaId')
  editarFicha(
    @Param('fichaId', ParseUUIDPipe) fichaId: string,
    @Body() dto: UpdateFichaDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.previewService.editarFicha(fichaId, dto, usuario.userId);
  }

  @Post(':fichaId/records')
  agregarFila(
    @Param('fichaId', ParseUUIDPipe) fichaId: string,
    @Body() dto: AgregarFilaDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.previewService.agregarFila(fichaId, dto, usuario.userId);
  }

  @Patch(':fichaId/records/:recordId')
  editarFila(
    @Param('fichaId', ParseUUIDPipe) fichaId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: UpdateFilaDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.previewService.editarFila(
      fichaId,
      recordId,
      dto,
      usuario.userId,
    );
  }

  @Delete(':fichaId/records/:recordId')
  eliminarFila(
    @Param('fichaId', ParseUUIDPipe) fichaId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.previewService.eliminarFila(fichaId, recordId, usuario.userId);
  }

  @Post(':fichaId/validate')
  validar(@Param('fichaId', ParseUUIDPipe) fichaId: string) {
    return this.validationService.verificar(fichaId);
  }

  @Post(':fichaId/lock')
  bloquear(@Param('fichaId', ParseUUIDPipe) fichaId: string) {
    return this.validationService.bloquear(fichaId);
  }

  @Post(':fichaId/commit')
  commit(
    @Param('fichaId', ParseUUIDPipe) fichaId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.commitService.confirmar(fichaId, usuario.userId);
  }

  @Delete(':fichaId')
  cancelar(@Param('fichaId', ParseUUIDPipe) fichaId: string) {
    return this.commitService.cancelar(fichaId);
  }

  // "Resubir CSV" / "Reiniciar ficha": vacía la tabla de mediciones actual
  // reutilizando el mismo fichaId, a diferencia de DELETE .../:fichaId
  // (cancelar), que borra la ficha entera — ver NewMeasurementCommitService.reiniciar.
  @Post(':fichaId/reset')
  reiniciar(
    @Param('fichaId', ParseUUIDPipe) fichaId: string,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.commitService.reiniciar(fichaId, usuario.userId);
  }
}
