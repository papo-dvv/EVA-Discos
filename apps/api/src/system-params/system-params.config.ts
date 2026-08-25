// Catálogo de parámetros del sistema que un administrador puede editar por
// PATCH /system-params/:clave, con la regla de validación de cada uno. Es la
// única fuente de verdad de "qué parámetros son configurables y de qué tipo";
// las claves espejan prisma/seed.ts (system_params). Una clave fuera de este
// catálogo se rechaza (no es configurable).

export type ReglaParam =
  | { tipo: 'numero'; entero?: boolean; min?: number; max?: number }
  | { tipo: 'enum'; valores: readonly string[] };

// Umbrales y parámetros numéricos vs. el método de outlier (enum de texto).
export const PARAMS_EDITABLES: Record<string, ReglaParam> = {
  rd_umbral_ok: { tipo: 'numero' },
  rd_umbral_seguimiento: { tipo: 'numero' },
  rd_umbral_critico: { tipo: 'numero' },
  h_umbral_reperfilado: { tipo: 'numero', min: 0 },
  reperfilado_descuento_rd: { tipo: 'numero', min: 0 },
  proyeccion_h_umbral_reperfilado: { tipo: 'numero', min: 0 },
  proyeccion_rd_umbral_cambio: { tipo: 'numero', min: 0 },
  proyeccion_reperfilado_descuento_rd: { tipo: 'numero', min: 0 },
  outlier_parametro: { tipo: 'numero', min: 0 },
  dias_anticipacion_agenda: { tipo: 'numero', entero: true, min: 0 },
  km_mensual: { tipo: 'numero', min: 0 },
  outlier_metodo: {
    tipo: 'enum',
    valores: ['desviacion_estandar', 'iqr', 'umbral_fijo'],
  },
  // Percentiles de trazabilidad — ÚNICOS configurables de los 3 métodos
  // (Gauss y Tukey quedan fijos, ver traceability-stats.service.ts). Escala
  // "humana" 0-100 (ej. 20 = P20), validada acá; ConsensoConfigService la
  // divide entre 100 al resolver la fracción 0..1. Cambiar cualquiera de
  // estas 4 claves dispara la validación de consenso (Reglas A/B) en
  // SystemParamsService.actualizar — ver ConsensoValidationService.
  percentil_limite_inferior: { tipo: 'numero', min: 0, max: 100 },
  percentil_limite_superior: { tipo: 'numero', min: 0, max: 100 },
  percentil_extremo_inferior: { tipo: 'numero', min: 0, max: 100 },
  percentil_extremo_superior: { tipo: 'numero', min: 0, max: 100 },
  // Piso del extremo inferior de consenso cuando calcula <= 0.00 (Regla B) —
  // cambiar ESTA clave no dispara la validación de consenso (no afecta
  // gauss/percentiles/tukey, solo a qué valor se ajusta un extremo ya
  // detectado en 0 o negativo).
  consenso_extremo_epsilon: { tipo: 'numero', min: 0 },
  // Amplitud máxima permitida del EXTREMO de consenso (superior - inferior)
  // — cambiar ESTA clave tampoco dispara la validación de consenso (no es un
  // percentil, es el umbral que usa la Regla A extendida al extremo, ver
  // ConsensoValidationService). La fila puede no existir o valer '' (sin
  // restricción activa); una vez seteada a un número por PATCH ya no hay
  // forma de volver a "sin restricción" por API — mismo límite que ya tiene
  // consenso_extremo_epsilon.
  amplitud_maxima_extremo: { tipo: 'numero', min: 0 },
  // Valor absoluto del coeficiente de asimetría (Fisher-Pearson ajustado, ver
  // calcularAsimetria en traceability-stats.service.ts) por debajo del cual
  // la distribución de trazabilidad se considera SIMETRICA — cambiar ESTA
  // clave tampoco dispara la validación de consenso (no es un percentil, no
  // afecta gauss/percentiles/tukey/consenso, solo la clasificación de
  // asimetria en /traceability/summary).
  asimetria_umbral_simetrica: { tipo: 'numero', min: 0 },
  // Rango de diferenciaKm (wear_rate_pairs) que alimenta la tasa promedio de
  // desgaste por tipo de coche usada en Proyección de Reperfilado y Cambio
  // (ver ProyeccionRateService) — mismo criterio de "tramo ni muy corto ni
  // muy largo" que KM_RANGO_INFERIOR/SUPERIOR en traceability.service.ts,
  // pero configurable acá porque es un parámetro propio de Proyección, no de
  // Trazabilidad.
  proyeccion_km_rango_min: { tipo: 'numero', min: 0 },
  proyeccion_km_rango_max: { tipo: 'numero', min: 0 },
  // Umbral configurable de "hace cuánto no se mide" (MeasurementGapModule) —
  // la alerta SEVERA queda fija en 7 meses en el código, nunca lee esta
  // clave (ver measurement-gap.service.ts).
  measurement_gap_umbral_meses: { tipo: 'numero', min: 0 },
  // Umbrales (días sin medir) del semáforo de tarjetas de Mediciones — ver
  // MedicionesSemaforoConfigService. Normal es implícito (todo por debajo de
  // dias_semaforo_alerta); Prioridad no tiene techo.
  dias_semaforo_alerta: { tipo: 'numero', entero: true, min: 1 },
  dias_semaforo_critico: { tipo: 'numero', entero: true, min: 1 },
  dias_semaforo_prioridad: { tipo: 'numero', entero: true, min: 1 },
};

// Parámetros incorporados después de que algunas instalaciones ya tenían su
// tabla system_params poblada. Se exponen desde el API aunque aún no tengan
// fila física; al primer guardado se crean sin resembrar ni alterar valores
// existentes de otros parámetros.
export const PARAMS_INICIALES_FALTANTES: Record<
  string,
  { valor: string; descripcion: string }
> = {
  dias_semaforo_alerta: {
    valor: '16',
    descripcion:
      'Días sin medir a partir de los cuales el tren pasa a Alerta en la vista de tarjetas de Mediciones',
  },
  dias_semaforo_critico: {
    valor: '26',
    descripcion:
      'Días sin medir a partir de los cuales el tren pasa a Crítico en la vista de tarjetas de Mediciones',
  },
  dias_semaforo_prioridad: {
    valor: '31',
    descripcion:
      'Días sin medir a partir de los cuales el tren pasa a Prioridad en la vista de tarjetas de Mediciones',
  },
  proyeccion_h_umbral_reperfilado: {
    valor: '1.6',
    descripcion:
      'Umbral H usado exclusivamente por la proyección de reperfilado (mm)',
  },
  proyeccion_rd_umbral_cambio: {
    valor: '0.4',
    descripcion:
      'Umbral Rd para proyectar un cambio; no altera las mediciones (mm)',
  },
  proyeccion_reperfilado_descuento_rd: {
    valor: '0.8',
    descripcion:
      'Descuento Rd tras un reperfilado, usado exclusivamente por Proyección (mm)',
  },
};

// Valida y normaliza el valor recibido según la regla de la clave. Devuelve el
// valor de texto a guardar (numérico normalizado o el enum tal cual) o un
// mensaje de error si no cumple. Nunca lanza: quien llama decide la excepción.
export function validarValorParam(
  valor: string,
  regla: ReglaParam,
): { ok: true; valor: string } | { ok: false; motivo: string } {
  const texto = valor.trim();

  if (regla.tipo === 'enum') {
    if (!regla.valores.includes(texto)) {
      return {
        ok: false,
        motivo: `Valor inválido. Debe ser uno de: ${regla.valores.join(', ')}.`,
      };
    }
    return { ok: true, valor: texto };
  }

  const numero = Number(texto);
  if (texto === '' || !Number.isFinite(numero)) {
    return { ok: false, motivo: 'El valor debe ser numérico.' };
  }
  if (regla.entero && !Number.isInteger(numero)) {
    return { ok: false, motivo: 'El valor debe ser un número entero.' };
  }
  if (regla.min !== undefined && numero < regla.min) {
    return {
      ok: false,
      motivo: `El valor no puede ser menor que ${regla.min}.`,
    };
  }
  if (regla.max !== undefined && numero > regla.max) {
    return {
      ok: false,
      motivo: `El valor no puede ser mayor que ${regla.max}.`,
    };
  }
  // Se guarda la forma canónica del número (ej. "1.50" -> "1.5").
  return { ok: true, valor: String(numero) };
}
