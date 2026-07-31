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
