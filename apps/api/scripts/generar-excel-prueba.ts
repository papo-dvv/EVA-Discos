import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { writeFile } from 'xlsx';
import { construirWorkbookPrueba } from '../src/migration/__fixtures__/construir-workbook-prueba';

// Genera el .xlsx de prueba en disco para probar POST /migration/upload.
// Uso: npx tsx scripts/generar-excel-prueba.ts
const destino = resolve(__dirname, '../test-data/migracion-prueba.xlsx');
mkdirSync(dirname(destino), { recursive: true });

writeFile(construirWorkbookPrueba(), destino);
console.log(`Excel de prueba generado en: ${destino}`);
