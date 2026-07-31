// Mecanismo de bucketing por mes calendario compartido entre /wear-rate/chart
// (WearRateService.obtenerChart, promedio de tasaMensual sobre pares válidos)
// y /traceability/series con agregacion=mensual (TraceabilityService,
// promedio de valorLimpio sobre puntos normal/recortado). Cada dominio tiene
// su propio shape de acumulador (conteos distintos: válidos/inválidos acá,
// normal/recortado allá) — lo único genuinamente duplicado entre ambos era el
// bucketing en sí (derivar la clave YYYY-MM y acumular por balde), así que
// solo eso se extrajo: el llamador aporta su propio acumulador inicial y
// reductor.

export function agruparPorMes<T, A>(
  items: T[],
  fecha: (item: T) => Date,
  inicial: () => A,
  reducir: (acumulado: A, item: T) => A,
): Map<string, A> {
  const porMes = new Map<string, A>();
  for (const item of items) {
    const mes = fecha(item).toISOString().slice(0, 7); // YYYY-MM
    const acumuladoPrevio = porMes.get(mes) ?? inicial();
    porMes.set(mes, reducir(acumuladoPrevio, item));
  }
  return porMes;
}

// Paso final también compartido: de Map a array ordenado cronológicamente
// por clave de mes (las claves YYYY-MM ordenan correctamente como string).
export function ordenarPorMes<A>(porMes: Map<string, A>): [string, A][] {
  return [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b));
}
