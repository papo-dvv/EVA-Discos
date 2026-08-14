import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { aBoolean } from '../../migration/dto/preview-query.dto';
import {
  MOTIVOS_RECONOCIDOS,
  type MotivoFicha,
} from '../new-measurement-csv.parser';

// Acompaña al multipart del CSV (campo de texto adicional junto a `file`).
// Sin motivo -> 'Medición' (único implementado). Los otros 2 valores del
// enunciado se aceptan acá SOLO para poder rechazarlos con un mensaje claro
// ("no implementado aún") en vez de un 400 genérico de "propiedad inválida".
export class UploadCsvDto {
  @IsOptional()
  @IsIn(MOTIVOS_RECONOCIDOS)
  motivo?: MotivoFicha;

  // Reintento del mismo archivo tras una advertencia de duplicado exacto
  // (ver NewMeasurementService.subirCsv, punto 2 del enunciado): 'true'/'false'
  // llega como texto en el multipart, igual que el resto de booleanos de
  // query/body tolerantes del sistema — ver aBoolean.
  @IsOptional()
  @Transform(({ value }) => aBoolean(value))
  @IsBoolean()
  forzar?: boolean;
}
