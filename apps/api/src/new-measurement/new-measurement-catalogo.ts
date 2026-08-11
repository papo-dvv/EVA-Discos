import { BadRequestException } from '@nestjs/common';
import type { TipoCoche, Train } from '../../generated/prisma';
import type { PrismaService } from '../prisma/prisma.service';

// Compartido entre NewMeasurementService (upload/manual) y
// NewMeasurementPreviewService (edición de filas): una sola fuente de verdad
// para "qué tren es válido" y "qué número de coche le corresponde a cada
// tipo de coche de este tren", sin duplicar las queries en cada servicio.

// Tren 6-44, exclusivamente flota Alstom (Metropolis9000) — la flota Ansaldo
// (1-5) queda excluida (sin catálogo de coches/discos sembrado todavía).
export async function validarTrenAlstom(
  prisma: Pick<PrismaService, 'train'>,
  trenNumero: number,
): Promise<Train> {
  const tren = await prisma.train.findUnique({ where: { numero: trenNumero } });
  if (!tren || tren.modelo !== 'alstom_metropolis9000') {
    throw new BadRequestException(
      `El tren ${trenNumero} no es válido para una ficha de medición (solo flota Alstom, trenes 6-44).`,
    );
  }
  return tren;
}

export async function validarTrenCatalogo(
  prisma: Pick<PrismaService, 'train'>,
  trenNumero: number,
): Promise<Train> {
  const tren = await prisma.train.findUnique({ where: { numero: trenNumero } });
  if (!tren) {
    throw new BadRequestException(
      `El tren ${trenNumero} no existe en el catálogo (ANSALDO 1-5, ALSTOM 6-44).`,
    );
  }
  return tren;
}

export async function resolverNumerosCochePorTren(
  prisma: Pick<PrismaService, 'wagonUnit'>,
  trenId: string,
): Promise<Partial<Record<TipoCoche, number>>> {
  const wagons = await prisma.wagonUnit.findMany({
    where: { trenId },
    select: { tipoCoche: true, numeroCoche: true },
  });
  const mapa: Partial<Record<TipoCoche, number>> = {};
  for (const w of wagons) mapa[w.tipoCoche] = w.numeroCoche;
  return mapa;
}
