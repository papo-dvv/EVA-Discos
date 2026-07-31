import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, type ModeloTren } from '../generated/prisma'

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

async function main() {
  await seedBogieCatalog()
  await seedSystemParams()
  await seedUsuarioSistema()
  await seedAdministrador()
  await seedTrains()
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
