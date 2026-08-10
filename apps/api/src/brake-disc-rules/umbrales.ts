// Umbrales de negocio del motor de reglas de discos de freno. Viven en
// system_params (ver schema_eva.sql §7 y prisma/seed.ts) para que un
// administrador los pueda ajustar sin tocar código — acá solo se define su
// forma y los valores de respaldo si la fila todavía no existe en la base.

export interface Umbrales {
  rdUmbralOk: number;
  rdUmbralSeguimiento: number;
  rdUmbralCritico: number;
  hUmbralReperfilado: number;
  reperfiladoDescuentoRd: number;
}

// Claves exactas de system_params.clave (ver prisma/seed.ts).
export const CLAVES_UMBRALES = {
  rdUmbralOk: 'rd_umbral_ok',
  rdUmbralSeguimiento: 'rd_umbral_seguimiento',
  rdUmbralCritico: 'rd_umbral_critico',
  hUmbralReperfilado: 'h_umbral_reperfilado',
  reperfiladoDescuentoRd: 'reperfilado_descuento_rd',
} as const satisfies Record<keyof Umbrales, string>;

export const UMBRALES_POR_DEFECTO: Umbrales = {
  rdUmbralOk: 1.0,
  rdUmbralSeguimiento: 0.4,
  rdUmbralCritico: 0.0,
  hUmbralReperfilado: 1.6,
  reperfiladoDescuentoRd: 0.8,
};
