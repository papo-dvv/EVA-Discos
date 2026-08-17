import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsObject,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

// "Realizado por" — 1 de las 4 filas fijas (posicion 1-4) de la ficha. Todos
// los campos son opcionales incluso dentro de la fila: solo
// responsable_mantenimiento_nombre (en la ficha padre) es obligatorio.
export class TecnicoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(4)
  posicion!: number;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  firma?: string;

  @IsOptional()
  @IsDateString()
  fecha?: string;
}

// Instrumento usado — 1 de las 3 filas fijas (posicion 1-3) de la ficha.
export class InstrumentoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  posicion!: number;

  @IsOptional()
  @IsString()
  codigo?: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsOptional()
  @IsString()
  modeloMarca?: string;

  @IsOptional()
  @IsDateString()
  fechaCalibracion?: string;

  @IsOptional()
  @IsDateString()
  fechaVencimientoCalibracion?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class CodigosCocheDto {
  @IsOptional() @Type(() => Number) @IsInt() MA1?: number;
  @IsOptional() @Type(() => Number) @IsInt() MB1?: number;
  @IsOptional() @Type(() => Number) @IsInt() MB3?: number;
  @IsOptional() @Type(() => Number) @IsInt() REM?: number;
  @IsOptional() @Type(() => Number) @IsInt() MB2?: number;
  @IsOptional() @Type(() => Number) @IsInt() MA2?: number;
}

// Edición de la cabecera de la ficha: header autocompletado (Tren/
// Kilometraje/Fecha, editables — ver punto 2 del enunciado), conformidad,
// firmas y catálogos fijos de técnicos/instrumentos. Todo opcional: se envía
// solo lo que cambia.
export class UpdateFichaDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => CodigosCocheDto)
  codigosCoche?: CodigosCocheDto;

  @IsOptional()
  @IsObject()
  codigosBogie?: Record<string, string>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  trenNumero?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  kilometraje?: number;

  @IsOptional()
  @IsDateString()
  fechaFicha?: string;

  @IsOptional()
  @IsString()
  puestoTrabajo?: string;

  @IsOptional()
  @IsDateString()
  fechaHoraInicio?: string;

  @IsOptional()
  @IsDateString()
  fechaHoraFin?: string;

  @IsOptional()
  @IsBoolean()
  todasConformes?: boolean;

  @IsOptional()
  @IsString()
  comentariosActividad?: string;

  @IsOptional()
  @IsString()
  responsableMantenimientoNombre?: string;

  // P.T. (Puesto de Trabajo) — texto libre alfanumérico, sin formato
  // restringido. Siempre ingreso manual (el CSV nunca lo trae). Obligatorio
  // para bloquear (POST .../lock) y confirmar (POST .../commit) — ver
  // NewMeasurementValidationService.bloquear y NewMeasurementCommitService.confirmar.
  @IsOptional()
  @IsString()
  ptCodigo?: string;

  @IsOptional()
  @IsString()
  responsableMantenimientoFirma?: string;

  @IsOptional()
  @IsDateString()
  responsableMantenimientoFecha?: string;

  @IsOptional()
  @IsString()
  ingMrNombre?: string;

  @IsOptional()
  @IsString()
  ingMrFirma?: string;

  @IsOptional()
  @IsDateString()
  ingMrFecha?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TecnicoDto)
  tecnicos?: TecnicoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstrumentoDto)
  instrumentos?: InstrumentoDto[];
}
