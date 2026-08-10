import { IsIn } from 'class-validator';
import { ModuloSnapshot } from '../../../generated/prisma';

const MODULOS_VALORES = Object.values(ModuloSnapshot);

// `modulo` es obligatorio (sin @IsOptional): no tiene sentido pedir "el
// último snapshot" sin decir de cuál de los 2 módulos.
export class ModuleSnapshotQueryDto {
  @IsIn(MODULOS_VALORES)
  modulo!: ModuloSnapshot;
}
