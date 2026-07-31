import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { read } from 'xlsx';
import { BrakeDiscRulesEngine } from '../src/brake-disc-rules/brake-disc-rules.engine';
import { UMBRALES_POR_DEFECTO } from '../src/brake-disc-rules/umbrales';
import { procesarWorkbook } from '../src/migration/migration-excel.parser';

// ⚠️ SCRIPT TEMPORAL DE DIAGNÓSTICO — REMOVER junto con la instrumentación.
// Corre el parser (con su instrumentación [MIGRACION-DEBUG]) directamente sobre
// un archivo real, leyéndolo con las MISMAS opciones que el endpoint real
// (cellDates:true, bookVBA:false). Imprime el log de la primera hoja + resumen.
//
// Uso:  npx tsx scripts/diagnostico-migracion.ts "C:/ruta/al/archivo-real.xlsm"

const ruta = process.argv[2];
if (!ruta) {
  console.error(
    'Falta la ruta del archivo. Uso: npx tsx scripts/diagnostico-migracion.ts <ruta .xlsx|.xlsm>',
  );
  process.exit(1);
}

const buffer = readFileSync(resolve(ruta));
const workbook = read(buffer, { type: 'buffer', cellDates: true, bookVBA: false });

console.log(`[DIAG] Archivo: ${ruta}`);
console.log(`[DIAG] Hojas en el workbook: ${workbook.SheetNames.length}`);
console.log(`[DIAG] Nombres: ${JSON.stringify(workbook.SheetNames)}`);

const evaluador = new BrakeDiscRulesEngine(UMBRALES_POR_DEFECTO);
const res = procesarWorkbook(workbook, evaluador);

console.log('[DIAG] ===== RESUMEN =====');
console.log(`[DIAG] hojasProcesadas: ${res.hojasProcesadas.length}`);
console.log(`[DIAG] totalFilasLeidas: ${res.totalFilasLeidas}`);
console.log(`[DIAG] filasValidas: ${res.filas.length}`);
console.log(`[DIAG] filasVaciasOmitidas: ${res.filasVaciasOmitidas}`);
console.log(`[DIAG] filasInvalidas: ${res.filasInvalidas.length}`);
