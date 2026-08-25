import { Injectable } from '@nestjs/common';
import { UMBRALES_POR_DEFECTO } from '../brake-disc-rules/umbrales';
import { PrismaService } from '../prisma/prisma.service';

export const CLAVES_UMBRALES_PROYECCION = {
  hUmbralReperfilado: 'proyeccion_h_umbral_reperfilado',
  rdUmbralCambio: 'proyeccion_rd_umbral_cambio',
  reperfiladoDescuentoRd: 'proyeccion_reperfilado_descuento_rd',
} as const;

export interface UmbralesProyeccion {
  hUmbralReperfilado: number;
  rdUmbralCambio: number;
  reperfiladoDescuentoRd: number;
}

// Los valores de proyección son deliberadamente independientes de los
// umbrales que clasifican mediciones confirmadas. Así una simulación no
// altera el resultado histórico ni las acciones operativas.
@Injectable()
export class ProyeccionUmbralesService {
  constructor(private readonly prisma: PrismaService) {}

  async obtener(): Promise<UmbralesProyeccion> {
    const claves = Object.values(CLAVES_UMBRALES_PROYECCION);
    const filas = await this.prisma.systemParam.findMany({
      where: { clave: { in: claves } },
    });
    const valores = new Map(filas.map((fila) => [fila.clave, fila.valor]));

    return {
      hUmbralReperfilado: this.leer(
        valores,
        CLAVES_UMBRALES_PROYECCION.hUmbralReperfilado,
        UMBRALES_POR_DEFECTO.hUmbralReperfilado,
      ),
      rdUmbralCambio: this.leer(
        valores,
        CLAVES_UMBRALES_PROYECCION.rdUmbralCambio,
        UMBRALES_POR_DEFECTO.rdUmbralSeguimiento,
      ),
      reperfiladoDescuentoRd: this.leer(
        valores,
        CLAVES_UMBRALES_PROYECCION.reperfiladoDescuentoRd,
        UMBRALES_POR_DEFECTO.reperfiladoDescuentoRd,
      ),
    };
  }

  private leer(
    valores: Map<string, string>,
    clave: string,
    defecto: number,
  ): number {
    const valor = Number(valores.get(clave));
    return Number.isFinite(valor) ? valor : defecto;
  }
}
