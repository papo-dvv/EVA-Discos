// Orden físico REAL de los coches en el tren (ver enunciado) — nunca
// alfabético (el alfabético daría MA1,MA2,MB1,MB2,MB3,REM, que no es la
// disposición real del convoy).
const ORDEN_COCHE: readonly string[] = [
  'MA1',
  'MB1',
  'MB3',
  'REM',
  'MB2',
  'MA2',
];

// Orden físico REAL de los 2 bogies DENTRO de cada coche. Depende del coche:
// MB1/MB3 y MB2 comparten el mismo par (PB6/PB2) pero en orden inverso, así
// que no alcanza con una tabla única bogie->posición.
const ORDEN_BOGIE_POR_COCHE: Readonly<Record<string, readonly string[]>> = {
  MA1: ['PB3', 'PB4'],
  MB1: ['PB6', 'PB2'],
  MB3: ['PB6', 'PB2'],
  REM: ['TB1', 'TB2'],
  MB2: ['PB2', 'PB6'],
  MA2: ['PB4', 'PB3'],
};

// Bases del encoding mixed-radix: cada nivel "pesa" lo suficiente para nunca
// pisar al nivel anterior. BASE_EJE=100 es un margen amplio (ejes reales son
// 1-2 por bogie) para que un dato inesperadamente grande no rompa el orden
// de coche/bogie que sí es estricto.
const BASE_BOGIE = 3; // 2 posiciones conocidas + 1 "sin resolver"
const BASE_EJE = 100;
// Margen amplio (ruedas reales son 1-48) para que un dato inesperadamente
// grande no rompa el orden de coche/bogie/eje que sí es estricto.
const BASE_RUEDA = 50;

const SIN_RESOLVER_COCHE = ORDEN_COCHE.length; // cae al final
const SIN_RESOLVER_BOGIE = 2; // cae al final DENTRO de su coche
const SIN_RESOLVER_EJE = BASE_EJE - 1;
const SIN_RESOLVER_RUEDA = BASE_RUEDA - 1;

export interface IdentidadFisica {
  tipoCoche: string | null;
  bogieCodigo: string | null;
  ejeNumero: number | null;
  ruedaNumero: number | null;
}

// Número que ordena coche+bogie+eje+rueda según la disposición FÍSICA real
// del tren (nunca alfabética) — cuanto menor, más "primero" en el recorrido
// físico. trenNumero NO entra acá a propósito: es una columna simple (ASC)
// que se ordena aparte, independiente de esto — ver scan-record-query.ts y
// wear-rate.service.ts.
//
// Identidad no resuelta (coche/bogie desconocidos o no numéricos, eje o
// rueda ausentes/fuera de rango) cae SIEMPRE al final de su nivel; nunca
// revienta ni se confunde con un valor real.
export function calcularOrdenFisico(identidad: IdentidadFisica): number {
  const coche = identidad.tipoCoche?.trim().toUpperCase() ?? '';
  const idxCoche = ORDEN_COCHE.indexOf(coche);
  const ordenCoche = idxCoche === -1 ? SIN_RESOLVER_COCHE : idxCoche;

  const bogiesDelCoche = ORDEN_BOGIE_POR_COCHE[coche];
  const bogie = identidad.bogieCodigo?.trim().toUpperCase() ?? '';
  const idxBogie = bogiesDelCoche?.indexOf(bogie) ?? -1;
  const ordenBogie = idxBogie === -1 ? SIN_RESOLVER_BOGIE : idxBogie;

  const eje = identidad.ejeNumero;
  const ordenEje =
    eje !== null && Number.isInteger(eje) && eje >= 0 && eje < SIN_RESOLVER_EJE
      ? eje
      : SIN_RESOLVER_EJE;

  // rueda ASC (1, 2, 3... 48) — reemplaza al viejo criterio de "lado" por
  // texto de Ubicación (ver enunciado): más preciso, no depende de que la
  // columna Ubicación del Excel esté bien escrita.
  const rueda = identidad.ruedaNumero;
  const ordenRueda =
    rueda !== null &&
    Number.isInteger(rueda) &&
    rueda >= 0 &&
    rueda < SIN_RESOLVER_RUEDA
      ? rueda
      : SIN_RESOLVER_RUEDA;

  return (
    ordenCoche * (BASE_BOGIE * BASE_EJE * BASE_RUEDA) +
    ordenBogie * (BASE_EJE * BASE_RUEDA) +
    ordenEje * BASE_RUEDA +
    ordenRueda
  );
}
