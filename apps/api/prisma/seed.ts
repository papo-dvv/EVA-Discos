import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type LadoDisco, type ModeloTren, type TipoCoche } from '../generated/prisma'

const BCRYPT_ROUNDS = 12
// Mismo UUID fijo que schema_eva.sql §7, para que el usuario "sistema" sea
// reconocible y estable entre entornos (se referencia desde scan_edit_log).
const SISTEMA_USER_ID = '00000000-0000-0000-0000-000000000001'

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

        for (const lado of ['izquierdo', 'derecho'] as const satisfies readonly LadoDisco[]) {
          // rueda = 2*eje (derecho) / 2*eje-1 (izquierdo) — confirmado en el
          // Excel real para las 48 ruedas de cada tren (1-48, se reinicia por
          // tren, no es global de la flota).
          const ruedaNumero = lado === 'derecho' ? 2 * ejeNumero : 2 * ejeNumero - 1

          await prisma.brakeDisc.upsert({
            where: {
              wagonUnitId_bogieCodigo_ejeNumero_lado: {
                wagonUnitId: wagon.id,
                bogieCodigo,
                ejeNumero,
                lado,
              },
            },
            update: { ruedaNumero },
            create: {
              wagonUnitId: wagon.id,
              bogieCodigo,
              ejeNumero,
              lado,
              ruedaNumero,
              stage: 'en_servicio',
              fase: 'usada',
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

async function main() {
  await seedBogieCatalog()
  await seedSystemParams()
  await seedUsuarioSistema()
  await seedAdministrador()
  await seedTrains()
  await seedFlotaAlstom()
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
