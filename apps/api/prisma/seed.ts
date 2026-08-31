import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type EstadoDisco, type LadoDisco, type ModeloTren, type PosicionDisco, type TipoCoche } from '../generated/prisma'

const BCRYPT_ROUNDS = 12
// Mismo UUID fijo que schema_eva.sql §7, para que el usuario "sistema" sea
// reconocible y estable entre entornos (se referencia desde scan_edit_log).
const SISTEMA_USER_ID = '00000000-0000-0000-0000-000000000001'
// UUID fijo del UploadedFile "técnico" que agrupa los ScanRecord sintéticos
// de seedInventarioPrueba() — ver comentario ahí. Fijo para que el seed sea
// idempotente (upsert por id) y para poder borrar/recrear SOLO sus filas sin
// tocar ScanRecord de otros archivos.
const ARCHIVO_SEED_INVENTARIO_ID = '00000000-0000-0000-0000-0000000000f1'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function seedBogieCatalog() {
  const bogies = [
    { codigo: 'PB2', descripcion: 'Bogie motor tipo 2' },
    { codigo: 'PB3', descripcion: 'Bogie motor tipo 3' },
    { codigo: 'PB4', descripcion: 'Bogie motor tipo 4' },
    { codigo: 'PB6', descripcion: 'Bogie motor tipo 6' },
    { codigo: 'TB1', descripcion: 'Bogie remolque tipo 1' },
    { codigo: 'TB2', descripcion: 'Bogie remolque tipo 2' },
    // Ansaldo (verificado contra el Excel real, test-data/CONTROL TOP - copia
    // ANSALDO.xlsm): catálogo de 6 códigos reutilizados por tipo de coche
    // dentro de cada tren (mismo patrón que PB2..TB2 para Alstom) — M20 usa
    // C1/C2, M21 usa C3/C4, M22 usa C5/C6.
    { codigo: 'C1', descripcion: 'Bogie Ansaldo tipo 1' },
    { codigo: 'C2', descripcion: 'Bogie Ansaldo tipo 2' },
    { codigo: 'C3', descripcion: 'Bogie Ansaldo tipo 3' },
    { codigo: 'C4', descripcion: 'Bogie Ansaldo tipo 4' },
    { codigo: 'C5', descripcion: 'Bogie Ansaldo tipo 5' },
    { codigo: 'C6', descripcion: 'Bogie Ansaldo tipo 6' },
  ]
  for (const b of bogies) {
    await prisma.bogieCatalog.upsert({
      where: { codigo: b.codigo },
      update: { descripcion: b.descripcion },
      create: b,
    })
  }
  console.log(`bogie_catalog: ${bogies.length} registros`)
}

async function seedSystemParams() {
  const params = [
    { clave: 'rd_umbral_ok', valor: '1.00', descripcion: 'Rd mínimo para estado OK (mm)' },
    { clave: 'rd_umbral_seguimiento', valor: '0.40', descripcion: 'Rd mínimo para estado Seguimiento, por debajo de OK (mm)' },
    { clave: 'rd_umbral_critico', valor: '0.00', descripcion: 'Rd igual o menor a este valor es estado Crítico (mm)' },
    { clave: 'h_umbral_reperfilado', valor: '1.60', descripcion: 'H mínimo para que el reperfilado sea viable (mm)' },
    { clave: 'reperfilado_descuento_rd', valor: '0.80', descripcion: 'Cuánto se descuenta a Rd tras un reperfilado (mm)' },
    { clave: 'proyeccion_h_umbral_reperfilado', valor: '1.60', descripcion: 'Umbral H usado exclusivamente por la proyección de reperfilado (mm)' },
    { clave: 'proyeccion_rd_umbral_cambio', valor: '0.40', descripcion: 'Umbral Rd para proyectar un cambio; no altera la clasificación de mediciones (mm)' },
    { clave: 'proyeccion_reperfilado_descuento_rd', valor: '0.80', descripcion: 'Descuento Rd tras un reperfilado, usado exclusivamente por Proyección (mm)' },
    { clave: 'outlier_metodo', valor: 'iqr', descripcion: 'Método activo de detección de outliers: desviacion_estandar | iqr | umbral_fijo' },
    { clave: 'outlier_parametro', valor: '1.5', descripcion: 'Parámetro del método de outlier activo (ej. multiplicador IQR)' },
    { clave: 'dias_anticipacion_agenda', valor: '15', descripcion: 'Días de anticipación para sugerir agendar un cambio/reperfilado' },
    { clave: 'km_mensual', valor: '11300', descripcion: 'Kilometraje mensual estimado de la flota, usado para proyectar la tasa mensual de desgaste. Cambiarlo NO recalcula los pares ya existentes (quedan con el valor vigente al momento de su cálculo); solo afecta los cálculos nuevos de aquí en adelante.' },
    { clave: 'tasa_desgaste_km_maximo', valor: '50000', descripcion: 'Diferencia de kilometraje máxima (km) que puede tener un par de mediciones para entrar al promedio de tasa mensual fleet-wide del dashboard (KPI "Tasa promedio por mes"). Pares con un salto mayor (discos con historial disperso) reparten todo su desgaste acumulado como si fuera constante mes a mes, inflando la tasa estimada.' },
    { clave: 'percentil_limite_inferior', valor: '25', descripcion: 'Percentil inferior (0-100) del límite de consenso de trazabilidad. Gauss y Tukey quedan fijos; este es uno de los 4 únicos parámetros configurables del cálculo de consenso.' },
    { clave: 'percentil_limite_superior', valor: '75', descripcion: 'Percentil superior (0-100) del límite de consenso de trazabilidad.' },
    { clave: 'percentil_extremo_inferior', valor: '10', descripcion: 'Percentil inferior (0-100) del extremo de consenso de trazabilidad.' },
    { clave: 'percentil_extremo_superior', valor: '90', descripcion: 'Percentil superior (0-100) del extremo de consenso de trazabilidad.' },
    { clave: 'consenso_extremo_epsilon', valor: '0.001', descripcion: 'Valor mínimo al que se ajusta el extremo inferior de consenso de trazabilidad cuando el cálculo da <= 0.00.' },
    { clave: 'amplitud_maxima_extremo', valor: '', descripcion: 'Amplitud máxima permitida del EXTREMO de consenso de trazabilidad (superior - inferior). Vacío = sin restricción activa (comportamiento por defecto); igual criterio de rechazo que el límite (fijo en 0.25) pero opcional y configurable.' },
    { clave: 'asimetria_umbral_simetrica', valor: '0.5', descripcion: 'Valor absoluto del coeficiente de asimetría (Fisher-Pearson ajustado) de trazabilidad por debajo del cual la distribución se considera SIMETRICA. Por encima (o igual): SESGO_POSITIVO o SESGO_NEGATIVO según el signo.' },
    { clave: 'proyeccion_km_rango_min', valor: '7000', descripcion: 'Diferencia de kilometraje mínima (km) de los wear_rate_pairs que alimentan la tasa promedio de desgaste por tipo de coche usada en Proyección de Reperfilado y Cambio.' },
    { clave: 'proyeccion_km_rango_max', valor: '15000', descripcion: 'Diferencia de kilometraje máxima (km) de los wear_rate_pairs que alimentan la tasa promedio de desgaste por tipo de coche usada en Proyección de Reperfilado y Cambio.' },
    { clave: 'measurement_gap_umbral_meses', valor: '6', descripcion: 'Meses sin medición desde la última medición confirmada de un disco a partir de los cuales se muestra la alerta de "recomendado medir pronto" (ver MeasurementGapModule). La alerta SEVERA queda fija en 7 meses, no configurable.' },
    { clave: 'dias_semaforo_alerta', valor: '16', descripcion: 'Días sin medir a partir de los cuales el tren pasa a Alerta en la vista de tarjetas de Mediciones' },
    { clave: 'dias_semaforo_critico', valor: '26', descripcion: 'Días sin medir a partir de los cuales el tren pasa a Crítico en la vista de tarjetas de Mediciones' },
    { clave: 'dias_semaforo_prioridad', valor: '31', descripcion: 'Días sin medir a partir de los cuales el tren pasa a Prioridad en la vista de tarjetas de Mediciones' },
  ]
  for (const p of params) {
    await prisma.systemParam.upsert({
      where: { clave: p.clave },
      update: { valor: p.valor, descripcion: p.descripcion },
      create: p,
    })
  }
  console.log(`system_params: ${params.length} registros`)
}

async function seedUsuarioSistema() {
  // Password aleatoria que nunca se usará para login — el usuario queda
  // bloqueado. Solo existe para atribuir en scan_edit_log las correcciones
  // automáticas que no hizo una persona.
  const passwordAleatoria = randomBytes(32).toString('hex')
  const passwordHash = await bcrypt.hash(passwordAleatoria, BCRYPT_ROUNDS)

  await prisma.user.upsert({
    where: { id: SISTEMA_USER_ID },
    update: {},
    create: {
      id: SISTEMA_USER_ID,
      nombresCompletos: 'Sistema EVA',
      dni: '00000000',
      area: 'Sistema',
      rol: 'administrador',
      empresa: 'EVA',
      email: 'sistema@eva-l1.local',
      passwordHash,
      estadoCuenta: 'bloqueado',
      debeCambiarPassword: false,
      esUsuarioSistema: true,
    },
  })
  console.log('users: usuario "sistema" listo')
}

async function seedAdministrador() {
  const passwordHash = await bcrypt.hash('Eva#L1nea2026!', BCRYPT_ROUNDS)

  await prisma.user.upsert({
    where: { email: 'admin@eva-l1.local' },
    update: {},
    create: {
      nombresCompletos: 'Administrador EVA',
      dni: '00000001',
      area: 'Administración de Sistemas',
      rol: 'administrador',
      empresa: 'UNNA',
      email: 'admin@eva-l1.local',
      passwordHash,
      estadoCuenta: 'activo',
      debeCambiarPassword: true,
    },
  })
  console.log('users: administrador inicial listo')
}

async function seedTrains() {
  type TrainSeed = { numero: number; modelo: ModeloTren; color: string; velocidadMaxKmh: number }

  const trains: TrainSeed[] = [
    // Pseudo-tren "Reserva" (numero=0): unidades Ansaldo sin tren asignado —
    // hoja "UDT RESERVA" del Excel y coches de repuesto (ver flota.md). No es
    // un tren real en servicio; existe para que WagonUnit.trenId (NOT NULL)
    // y ScanRecord.trenNumero tengan un valor consistente sin volverse
    // nullable en cascada (ver migration-excel.parser.ts, TREN_RESERVA).
    {
      numero: 0,
      modelo: 'ansaldo_mb300' as const,
      color: 'gris',
      velocidadMaxKmh: 90,
    },
    ...Array.from({ length: 5 }, (_, i) => ({
      numero: i + 1,
      modelo: 'ansaldo_mb300' as const,
      color: 'rojo',
      velocidadMaxKmh: 90,
    })),
    ...Array.from({ length: 39 }, (_, i) => ({
      numero: i + 6,
      modelo: 'alstom_metropolis9000' as const,
      color: 'verde_blanco',
      velocidadMaxKmh: 80,
    })),
  ]

  for (const t of trains) {
    await prisma.train.upsert({
      where: { numero: t.numero },
      update: {},
      create: { ...t, estado: 'operativo' },
    })
  }
  console.log(`trains: ${trains.length} registros`)
}

// ============================================================================
// Catálogo de flota esperada (wagon_units + brake_discs) — SOLO los 39 trenes
// ALSTOM (6-44); los 5 Ansaldo (1-5) no tienen catálogo todavía. Verificado
// fila por fila contra el Excel maestro real (test-data/CONTROL TOP - copia.xlsm,
// hojas T06-T44) el 2026-08-06 — no es un patrón supuesto.
//
// Orden físico real de coche dentro del tren (ver también common/orden-fisico.ts,
// que ya usaba este mismo orden para otro propósito — coincide 1:1 con el
// Excel real, confirmación cruzada): MA1, MB1, MB3, REM, MB2, MA2.
//
// N° de coche por tren: dos series independientes que suben de a 1 por tren
// (nunca por coche) empezando en el tren 6 —
//   MA1/MB1/MB2/MA2 (serie 1xx): MA1 = 101 + 4*(tren-6), MB1 = MA1+1,
//     MB2 = MA1+2, MA2 = MA1+3 (101..256 a lo largo de los 39 trenes)
//   MB3 (serie 5xx): 501 + (tren-6)  (501..539)
//   REM (serie 4xx): 401 + (tren-6)  (401..439)
// El Excel real tiene 5 filas con errores de tipeo evidentes que rompen esta
// secuencia (contradicen el patrón que ellas mismas confirman en el resto de
// filas, y varias directamente violan la unicidad de N° de coche que exige
// wagon_units.numero_coche): T14 (MB3/REM repiten los de T13 en vez de
// 509/409), T19 (una fila de REM trae 514 en vez de 414 — 514 ya es el N° de
// MB3 de esa misma hoja), T26 (todas las columnas repiten exactamente los
// valores de T20), T34 y T38 (una fila de MB1 trae el N° de MA1 de la misma
// hoja en vez de MA1+1). En los 5 casos se usa el valor que da la fórmula
// (consistente con las otras 34 hojas), no el dato crudo con el typo.
//
// Eje/bogie por tipo de coche — FIJO en los 39 trenes sin ninguna excepción
// (a diferencia de N° de coche): 4 ejes por coche, primeros 2 en un bogie,
// últimos 2 en el otro.
const PLAN_EJES_POR_COCHE: Record<
  TipoCoche,
  { ejeInicio: number; bogiePorOffset: readonly [string, string, string, string] }
> = {
  MA1: { ejeInicio: 1, bogiePorOffset: ['PB3', 'PB3', 'PB4', 'PB4'] },
  MB1: { ejeInicio: 5, bogiePorOffset: ['PB6', 'PB6', 'PB2', 'PB2'] },
  MB3: { ejeInicio: 9, bogiePorOffset: ['PB6', 'PB6', 'PB2', 'PB2'] },
  REM: { ejeInicio: 13, bogiePorOffset: ['TB1', 'TB1', 'TB2', 'TB2'] },
  MB2: { ejeInicio: 17, bogiePorOffset: ['PB2', 'PB2', 'PB6', 'PB6'] },
  MA2: { ejeInicio: 21, bogiePorOffset: ['PB4', 'PB4', 'PB3', 'PB3'] },
}

const ORDEN_COCHE_TREN: readonly TipoCoche[] = [
  'MA1',
  'MB1',
  'MB3',
  'REM',
  'MB2',
  'MA2',
]

// serie es texto libre obligatorio a nivel de DTO (Inventario) pero nullable
// a nivel de columna (ver schema.prisma, BrakeDisc.serie) — piezas montadas
// directamente por este seed o por la migración masiva de Excel nunca traen
// un número de serie de fábrica real. Se genera uno sintético (MIG-xxxxxxxx)
// en vez de dejarlo null, para que Inventario siempre tenga algo que
// mostrar/buscar. Mismo criterio que MigrationCommitService.resolverBrakeDisc.
function generarSerieAuto(): string {
  return `MIG-${randomBytes(4).toString('hex').toUpperCase()}`
}

function numerosCochePorTren(numeroTren: number): Record<TipoCoche, number> {
  const idx = numeroTren - 6
  const ma1 = 101 + 4 * idx
  return {
    MA1: ma1,
    MB1: ma1 + 1,
    MB2: ma1 + 2,
    MA2: ma1 + 3,
    MB3: 501 + idx,
    REM: 401 + idx,
  }
}

async function seedFlotaAlstom() {
  let wagonUnits = 0
  let brakeDiscs = 0

  for (let numeroTren = 6; numeroTren <= 44; numeroTren++) {
    const tren = await prisma.train.findUniqueOrThrow({
      where: { numero: numeroTren },
    })
    const numerosCoche = numerosCochePorTren(numeroTren)

    for (const tipoCoche of ORDEN_COCHE_TREN) {
      const numeroCoche = numerosCoche[tipoCoche]
      const wagon = await prisma.wagonUnit.upsert({
        where: { numeroCoche },
        update: { tipoCoche, trenId: tren.id },
        create: { numeroCoche, tipoCoche, trenId: tren.id },
      })
      wagonUnits++

      const plan = PLAN_EJES_POR_COCHE[tipoCoche]
      for (let offset = 0; offset < 4; offset++) {
        const ejeNumero = plan.ejeInicio + offset
        const bogieCodigo = plan.bogiePorOffset[offset]
        // serie es DEL EJE — izquierdo y derecho de un mismo eje comparten
        // el mismo valor (ver comentario en schema.prisma, BrakeDisc.serie).
        // Se genera UNA vez por eje, fuera del loop de lado.
        const serieEje = generarSerieAuto()

        for (const lado of ['izquierdo', 'derecho'] as const satisfies readonly LadoDisco[]) {
          // rueda = 2*eje (derecho) / 2*eje-1 (izquierdo) — confirmado en el
          // Excel real para las 48 ruedas de cada tren (1-48, se reinicia por
          // tren, no es global de la flota).
          const ruedaNumero = lado === 'derecho' ? 2 * ejeNumero : 2 * ejeNumero - 1

          await prisma.brakeDisc.upsert({
            where: {
              wagonUnitId_bogieCodigo_ejeNumero_lado_posicion: {
                wagonUnitId: wagon.id,
                bogieCodigo,
                ejeNumero,
                lado,
                posicion: 'unica',
              },
            },
            update: { ruedaNumero },
            create: {
              wagonUnitId: wagon.id,
              bogieCodigo,
              ejeNumero,
              lado,
              posicion: 'unica',
              ruedaNumero,
              stage: 'en_servicio',
              fase: 'usada',
              serie: serieEje,
              fabricante: tren.modelo,
            },
          })
          brakeDiscs++
        }
      }
    }
  }

  console.log(
    `wagon_units: ${wagonUnits} registros (39 trenes ALSTOM x 6 coches) — brake_discs: ${brakeDiscs} registros (39 x 48)`,
  )
}

// Catálogo de flota Ansaldo (wagon_units + brake_discs) — 5 trenes + 2 coches
// de reserva bajo el pseudo-tren 0. Verificado contra el Excel real
// (test-data/CONTROL TOP - copia ANSALDO.xlsm, hojas T01-T05/UDT RESERVA) y
// espejo de flota.md.
//
// Tren 5 (17, 18, 304, 310, 22, 21) confirmado completo 2026-08 — antes solo
// tenía 4 coches (304, 310, 22, 21): los coches 17/18 habían quedado
// registrados bajo el Tren 2 en el Excel histórico original (hoja "T02" de
// 2025), un error de la planilla nunca detectado hasta cruzar la relación
// Coche-N° real. Los scan_records ya confirmados de esos 2 coches se
// corrigieron a mano (trenNumero 2 -> 5, con trenOriginalExcel/
// corregidoPorHoja para auditoría) — este seed solo importa para
// instalaciones nuevas desde cero.
//
// A diferencia de Alstom, los códigos de bogie (C1..C6) son fijos POR TIPO DE
// COCHE (no por posición dentro del tren): toda unidad M20 usa C1/C2, toda
// M21 usa C3/C4, toda M22 usa C5/C6 — confirmado que esto se repite igual
// para las 2 unidades de cada tipo dentro de un mismo tren (wagonUnitId ya
// distingue la instancia física, ver @@unique de BrakeDisc). El número de eje
// también se reinicia a {1,2} POR BOGIE (no es continuo 1-4 por coche como en
// Alstom).
//
// Cada eje tiene 4 discos (lado × posición: izquierdo/derecho × interior/
// exterior) en vez de 2 — la diferencia física central de Ansaldo frente a
// Alstom (ver PosicionDisco en schema.prisma).
const BOGIES_POR_TIPO_ANSALDO: Record<'M20' | 'M21' | 'M22', readonly [string, string]> = {
  M20: ['C1', 'C2'],
  M21: ['C3', 'C4'],
  M22: ['C5', 'C6'],
}

const COCHES_ANSALDO: ReadonlyArray<{
  trenNumero: number
  numeroCoche: number
  tipoCoche: 'M20' | 'M21' | 'M22'
}> = [
  { trenNumero: 1, numeroCoche: 1, tipoCoche: 'M20' },
  { trenNumero: 1, numeroCoche: 2, tipoCoche: 'M21' },
  { trenNumero: 1, numeroCoche: 301, tipoCoche: 'M22' },
  { trenNumero: 1, numeroCoche: 302, tipoCoche: 'M22' },
  { trenNumero: 1, numeroCoche: 4, tipoCoche: 'M21' },
  { trenNumero: 1, numeroCoche: 3, tipoCoche: 'M20' },
  { trenNumero: 2, numeroCoche: 5, tipoCoche: 'M20' },
  { trenNumero: 2, numeroCoche: 6, tipoCoche: 'M21' },
  { trenNumero: 2, numeroCoche: 303, tipoCoche: 'M22' },
  { trenNumero: 2, numeroCoche: 305, tipoCoche: 'M22' },
  { trenNumero: 2, numeroCoche: 8, tipoCoche: 'M21' },
  { trenNumero: 2, numeroCoche: 7, tipoCoche: 'M20' },
  { trenNumero: 3, numeroCoche: 9, tipoCoche: 'M20' },
  { trenNumero: 3, numeroCoche: 10, tipoCoche: 'M21' },
  { trenNumero: 3, numeroCoche: 306, tipoCoche: 'M22' },
  { trenNumero: 3, numeroCoche: 307, tipoCoche: 'M22' },
  { trenNumero: 3, numeroCoche: 12, tipoCoche: 'M21' },
  { trenNumero: 3, numeroCoche: 11, tipoCoche: 'M20' },
  { trenNumero: 4, numeroCoche: 13, tipoCoche: 'M20' },
  { trenNumero: 4, numeroCoche: 14, tipoCoche: 'M21' },
  { trenNumero: 4, numeroCoche: 308, tipoCoche: 'M22' },
  { trenNumero: 4, numeroCoche: 309, tipoCoche: 'M22' },
  { trenNumero: 4, numeroCoche: 16, tipoCoche: 'M21' },
  { trenNumero: 4, numeroCoche: 15, tipoCoche: 'M20' },
  { trenNumero: 5, numeroCoche: 17, tipoCoche: 'M20' },
  { trenNumero: 5, numeroCoche: 18, tipoCoche: 'M21' },
  { trenNumero: 5, numeroCoche: 304, tipoCoche: 'M22' },
  { trenNumero: 5, numeroCoche: 310, tipoCoche: 'M22' },
  { trenNumero: 5, numeroCoche: 22, tipoCoche: 'M21' },
  { trenNumero: 5, numeroCoche: 21, tipoCoche: 'M20' },
  // Reserva (pseudo-tren 0).
  { trenNumero: 0, numeroCoche: 20, tipoCoche: 'M20' },
  { trenNumero: 0, numeroCoche: 19, tipoCoche: 'M21' },
]

async function seedFlotaAnsaldo() {
  let wagonUnits = 0
  let brakeDiscs = 0
  const trenesCache = new Map<number, string>()

  for (const coche of COCHES_ANSALDO) {
    let trenId = trenesCache.get(coche.trenNumero)
    if (!trenId) {
      const tren = await prisma.train.findUniqueOrThrow({
        where: { numero: coche.trenNumero },
      })
      trenId = tren.id
      trenesCache.set(coche.trenNumero, trenId)
    }

    const wagon = await prisma.wagonUnit.upsert({
      where: { numeroCoche: coche.numeroCoche },
      update: { tipoCoche: coche.tipoCoche, trenId },
      create: { numeroCoche: coche.numeroCoche, tipoCoche: coche.tipoCoche, trenId },
    })
    wagonUnits++

    for (const bogieCodigo of BOGIES_POR_TIPO_ANSALDO[coche.tipoCoche]) {
      for (const ejeNumero of [1, 2]) {
        // serie es DEL EJE (mismo criterio que Alstom): las 4 filas de este
        // eje (izq/der x interior/exterior) comparten la misma serie.
        const serieEje = generarSerieAuto()

        for (const lado of ['izquierdo', 'derecho'] as const satisfies readonly LadoDisco[]) {
          const ruedaNumero = lado === 'derecho' ? 2 * ejeNumero : 2 * ejeNumero - 1

          for (const posicion of ['interior', 'exterior'] as const satisfies readonly PosicionDisco[]) {
            await prisma.brakeDisc.upsert({
              where: {
                wagonUnitId_bogieCodigo_ejeNumero_lado_posicion: {
                  wagonUnitId: wagon.id,
                  bogieCodigo,
                  ejeNumero,
                  lado,
                  posicion,
                },
              },
              update: { ruedaNumero },
              create: {
                wagonUnitId: wagon.id,
                bogieCodigo,
                ejeNumero,
                lado,
                posicion,
                ruedaNumero,
                stage: 'en_servicio',
                fase: 'usada',
                serie: serieEje,
                fabricante: 'ansaldo_mb300',
              },
            })
            brakeDiscs++
          }
        }
      }
    }
  }

  console.log(
    `wagon_units: ${wagonUnits} registros (flota Ansaldo + reserva) — brake_discs: ${brakeDiscs} registros (4 discos por eje)`,
  )
}

// Backfill idempotente, 2 pasadas:
//  1) Piezas con posición conocida (wagonUnitId/bogieCodigo/ejeNumero, aunque
//     ya no estén montadas — ver comentario "última posición conocida" en
//     OperationsCambioDiscoService) se agrupan de a 2 (izquierdo+derecho) y
//     quedan con LA MISMA serie — antes de este fix cada lado se backfilleaba
//     con una serie propia, lo cual ya no es válido (serie es del eje, ver
//     schema.prisma). También completa `fabricante` desde el modelo del tren.
//  2) Cualquier fila SIN posición conocida y sin serie (no debería quedar
//     ninguna tras el seed normal, pero es una red de seguridad) recibe una
//     serie propia — no tiene con quién emparejarse.
async function seedBackfillSerieFaltante() {
  const conPosicion = await prisma.brakeDisc.findMany({
    where: { bogieCodigo: { not: null }, ejeNumero: { not: null } },
    select: {
      id: true,
      serie: true,
      lado: true,
      wagonUnitId: true,
      bogieCodigo: true,
      ejeNumero: true,
      fabricante: true,
      wagonUnit: { select: { tren: { select: { modelo: true } } } },
    },
  })

  const grupos = new Map<string, typeof conPosicion>()
  for (const d of conPosicion) {
    const clave = `${d.wagonUnitId}|${d.bogieCodigo}|${d.ejeNumero}`
    const lista = grupos.get(clave) ?? []
    lista.push(d)
    grupos.set(clave, lista)
  }

  let unificados = 0
  for (const grupo of grupos.values()) {
    const serieComun = grupo.find((d) => d.serie)?.serie ?? generarSerieAuto()
    const fabricanteComun = grupo.find((d) => d.fabricante)?.fabricante ?? grupo[0]?.wagonUnit?.tren.modelo ?? null
    for (const d of grupo) {
      if (d.serie === serieComun && d.fabricante === fabricanteComun) continue
      await prisma.brakeDisc.update({
        where: { id: d.id },
        data: { serie: serieComun, fabricante: fabricanteComun },
      })
      unificados++
    }
  }

  const sueltasSinSerie = await prisma.brakeDisc.findMany({
    where: { serie: null, OR: [{ bogieCodigo: null }, { ejeNumero: null }] },
    select: { id: true },
  })
  for (const disco of sueltasSinSerie) {
    await prisma.brakeDisc.update({
      where: { id: disco.id },
      data: { serie: generarSerieAuto() },
    })
  }

  console.log(
    `brake_discs: ${unificados} filas unificadas por eje (serie/fabricante), ${sueltasSinSerie.length} sueltas sin serie backfilleadas`,
  )
}

// 10 EJES de prueba SUELTOS (sin montar — wagonUnitId/bogieCodigo/ejeNumero
// en null; solo `lado` se fija, igual que cualquier par dado de alta por
// InventoryService.registrar) para probar las 3 tablas de Inventario: 6
// pares (12 discos) en Almacén, 4 pares (8 discos) en Taller. Cada par
// COMPARTE serie (izquierdo y derecho del mismo eje, ver schema.prisma).
// Series fijas (DF-0001..DF-0010) para que el seed sea idempotente.
async function seedInventarioPrueba() {
  const MARCAS = ['Nextsense', 'Faiveley', 'Knorr-Bremse', 'SAB WABCO']
  const FABRICANTES = ['alstom_metropolis9000', 'ansaldo_mb300'] as const
  const LADOS = ['izquierdo', 'derecho'] as const satisfies readonly LadoDisco[]

  // Última medición simulada de los 4 pares de Taller — a diferencia de
  // Almacén (fase 'nueva': nunca se midieron, correcto que salgan en blanco
  // en Inventario), estos simulan discos que "volvieron de servicio", así
  // que SÍ deberían traer su último T/H/Rd/Estado conocido (igual que un
  // disco real dado de baja vía Operaciones → Cambio de disco, que conserva
  // su historial de scan_records al pasar de stage — ver
  // operations-cambio-disco.service.ts). Sin esto, la tabla de Taller
  // mostraba "—" en todas las columnas de Disco pese a estar en fase
  // 'usada' (reportado por el usuario 2026-08: parecía un bug, era falta de
  // este dato en el seed). 4 estados distintos a propósito, para poder ver
  // los 4 colores de estado en la demo.
  const MEDICION_TALLER: Record<string, { tValue: number; hValue: number; estadoCalculado: EstadoDisco; kilometraje: number; fecha: string }> = {
    'DF-0007': { tValue: 4.3, hValue: 3.1, estadoCalculado: 'OK', kilometraje: 812_400, fecha: '2026-07-02' },
    'DF-0008': { tValue: 3.6, hValue: 2.85, estadoCalculado: 'SEGUIMIENTO', kilometraje: 940_100, fecha: '2026-07-10' },
    'DF-0009': { tValue: 3.0, hValue: 2.72, estadoCalculado: 'CAMBIO', kilometraje: 1_015_600, fecha: '2026-07-18' },
    'DF-0010': { tValue: 2.75, hValue: 2.85, estadoCalculado: 'CRITICO', kilometraje: 1_082_900, fecha: '2026-07-25' },
  }

  const pares = [
    ...Array.from({ length: 6 }, (_, i) => ({
      serie: `DF-${String(i + 1).padStart(4, '0')}`,
      stage: 'almacen' as const,
      // Regla de negocio: un disco recién dado de alta siempre es 'nueva'
      // hasta que pase a servicio — nunca 'usada' estando en Almacén desde
      // el alta (ver comentario del usuario). Los que sí simulan "volvió de
      // servicio" quedan en Taller (fase 'usada'), no acá.
      fase: 'nueva' as const,
      marcaRueda: MARCAS[i % MARCAS.length],
      lote: `L-2026-${String(i + 1).padStart(2, '0')}`,
      fabricante: FABRICANTES[i % FABRICANTES.length],
    })),
    ...Array.from({ length: 4 }, (_, i) => ({
      serie: `DF-${String(i + 7).padStart(4, '0')}`,
      stage: 'taller' as const,
      fase: 'usada' as const,
      marcaRueda: MARCAS[i % MARCAS.length],
      lote: `L-2026-${String(i + 7).padStart(2, '0')}`,
      fabricante: FABRICANTES[i % FABRICANTES.length],
    })),
  ]

  // Limpieza de la corrida anterior: esa versión del seeder creaba discos
  // SUELTOS de a uno (lado null, serie propia por disco) — ya no son válidos
  // bajo el modelo de pares, se reemplazan por los pares de abajo.
  const { count: eliminados } = await prisma.brakeDisc.deleteMany({
    where: { serie: { startsWith: 'DF-' }, lado: null },
  })
  if (eliminados > 0) console.log(`brake_discs: ${eliminados} discos sueltos de prueba (versión vieja del seeder) eliminados`)

  let discos = 0
  const discoIdsPorSerie = new Map<string, string[]>()
  for (const par of pares) {
    for (const lado of LADOS) {
      const disco = await prisma.brakeDisc.upsert({
        where: { serie_lado_posicion: { serie: par.serie, lado, posicion: 'unica' } },
        update: {
          stage: par.stage,
          fase: par.fase,
          marcaRueda: par.marcaRueda,
          lote: par.lote,
          fabricante: par.fabricante,
          // Reactiva el disco si una corrida anterior de pruebas lo había
          // eliminado (soft-delete, activo=false) desde Inventario — sin
          // esto, re-sembrar no lo hacía visible de nuevo (bug detectado en
          // vivo: "Discos disponibles: 0" en Cambio de Disco pese a haber
          // corrido el seed).
          activo: true,
        },
        create: { ...par, lado },
      })
      discoIdsPorSerie.set(par.serie, [...(discoIdsPorSerie.get(par.serie) ?? []), disco.id])
      discos++
    }
  }

  // ScanRecord sintéticos de los 4 pares de Taller (ver MEDICION_TALLER) —
  // agrupados bajo un único UploadedFile "técnico" fijo (ARCHIVO_SEED_INVENTARIO_ID),
  // igual patrón que MeasurementSheet para fichas manuales. Se borran y
  // recrean en cada corrida (no hay una clave natural para upsert acá) —
  // acotado a ESTE fileId, nunca toca ScanRecord de archivos reales.
  await prisma.uploadedFile.upsert({
    where: { id: ARCHIVO_SEED_INVENTARIO_ID },
    update: {},
    create: {
      id: ARCHIVO_SEED_INVENTARIO_ID,
      filename: 'seed-inventario-prueba.csv',
      tipoCarga: 'csv_individual',
      uploadedBy: SISTEMA_USER_ID,
      status: 'committed',
    },
  })
  await prisma.scanRecord.deleteMany({ where: { fileId: ARCHIVO_SEED_INVENTARIO_ID } })
  const nuevosScanRecords = Object.entries(MEDICION_TALLER).flatMap(([serie, m]) =>
    (discoIdsPorSerie.get(serie) ?? []).map((discId) => ({
      fileId: ARCHIVO_SEED_INVENTARIO_ID,
      discId,
      responsableNombre: 'Sistema EVA',
      trenNumero: 0, // pseudo-tren Reserva: disco suelto, sin tren asignado.
      kilometraje: m.kilometraje,
      fecha: new Date(m.fecha),
      motivo: 'Medición',
      tValue: m.tValue,
      hValue: m.hValue,
      rdValue: Number((m.tValue - m.hValue).toFixed(3)),
      estadoCalculado: m.estadoCalculado,
    })),
  )
  if (nuevosScanRecords.length > 0) {
    await prisma.scanRecord.createMany({ data: nuevosScanRecords })
  }

  console.log(
    `brake_discs: ${pares.length} ejes de prueba / ${discos} discos (6 pares almacén, 4 pares taller) — ` +
      `scan_records: ${nuevosScanRecords.length} mediciones sintéticas de los pares de taller`,
  )
}

async function main() {
  await seedBogieCatalog()
  await seedSystemParams()
  await seedUsuarioSistema()
  await seedAdministrador()
  await seedTrains()
  await seedFlotaAlstom()
  await seedFlotaAnsaldo()
  await seedBackfillSerieFaltante()
  await seedInventarioPrueba()
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
