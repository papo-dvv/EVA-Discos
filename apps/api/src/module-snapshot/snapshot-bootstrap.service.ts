import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { ModuloSnapshot } from '../../generated/prisma';
import { GenerarSnapshotService } from './generar-snapshot.service';

// Dispara la generación automática del primer snapshot del mes de AMBOS
// módulos al arrancar el proceso — junto con el gancho equivalente en
// MigrationCommitService.confirmar (primer commit exitoso de la migración
// masiva), cubre "lo que ocurra primero" del enunciado. El propio
// UNIQUE(modulo, mesAnio) de GenerarSnapshotService.generar hace que solo la
// PRIMERA de las 2 vías que se dispare en un mes calendario dado persista
// algo; la otra siempre encuentra el registro ya creado y no hace nada.
//
// Un fallo acá (ej. la base de datos todavía no tiene datos, o cualquier
// otro error transitorio) nunca debe impedir que el servidor levante — se
// swallowea explícitamente, igual que MigrationCommitService trata la
// generación de snapshot como un paso de "mejor esfuerzo".
@Injectable()
export class SnapshotBootstrapService implements OnApplicationBootstrap {
  constructor(private readonly generarSnapshot: GenerarSnapshotService) {}

  async onApplicationBootstrap(): Promise<void> {
    await Promise.all([
      this.generarSnapshot
        .generar(ModuloSnapshot.trazabilidad)
        .catch(() => undefined),
      this.generarSnapshot
        .generar(ModuloSnapshot.proyeccion)
        .catch(() => undefined),
    ]);
  }
}
