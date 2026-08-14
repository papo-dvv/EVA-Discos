import { IsIn, IsOptional } from 'class-validator';
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
}
