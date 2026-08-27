import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import sharp from 'sharp';

export interface ResultadoOcrReperfilado {
  trenNumero: number | null;
  kilometraje: number | null;
  puestoTrabajo: string | null;
  fecha: string | null;
  horaInicio: string | null;
  horaFin: string | null;
  codigosCoche: Partial<Record<TipoCocheReperfilado, number>>;
  codigosBogie: Record<string, string>;
  comentariosActividad: string | null;
  tecnicos: PersonaOcr[];
  instrumentos: InstrumentoOcr[];
  ingMr: PersonaOcr | null;
  responsableMantenimiento: PersonaOcr | null;
  confianza: number;
  filas: Array<{
    ejeNumero: number;
    lado: 'izquierdo' | 'derecho';
    tAntes: number;
    hAntes: number;
    tValue: number;
    hValue: number;
    rugosidadRa: number;
    confianza: number;
  }>;
  advertencias: string[];
  textoReconocido: string;
}

type CajaFirma = [number, number, number, number];
type PersonaOcr = {
  posicion?: number;
  nombre: string | null;
  fecha: string | null;
  firma: string | null;
};
type InstrumentoOcr = {
  posicion: number;
  codigo: string | null;
  descripcion: string | null;
  modeloMarca: string | null;
  fechaCalibracion: string | null;
  fechaVencimientoCalibracion: string | null;
  observaciones: string | null;
};

type TipoCocheReperfilado = 'MA1' | 'MB1' | 'MB3' | 'REM' | 'MB2' | 'MA2';

type RespuestaGemini = {
  tipoFormato: 'UT-UF-MTO-FR-414' | 'CONCAR' | 'otro';
  trenNumero: number | null;
  kilometraje: number | null;
  puestoTrabajo: string | null;
  fecha: string | null;
  horaInicio: string | null;
  horaFin: string | null;
  codigosCoche: Record<TipoCocheReperfilado, number | null>;
  codigosBogie: Array<{
    tipoCoche: TipoCocheReperfilado;
    tipoBogie: string;
    codigo: string | null;
  }>;
  comentariosActividad: string | null;
  tecnicos: Array<
    Omit<PersonaOcr, 'firma'> & {
      posicion: number;
      firmaCaja: CajaFirma | null;
    }
  >;
  instrumentos: InstrumentoOcr[];
  ingMr: (Omit<PersonaOcr, 'firma'> & { firmaCaja: CajaFirma | null }) | null;
  responsableMantenimiento:
    (Omit<PersonaOcr, 'firma'> & { firmaCaja: CajaFirma | null }) | null;
  confianza: number;
  filas: Array<{
    ejeNumero: number;
    lado: 'izquierdo' | 'derecho';
    tAntes: number;
    hAntes: number;
    tValue: number;
    hValue: number;
    rugosidadRa: number;
    confianza: number;
  }>;
  advertencias: string[];
};

const ESQUEMA_RESPUESTA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'tipoFormato',
    'trenNumero',
    'kilometraje',
    'puestoTrabajo',
    'fecha',
    'horaInicio',
    'horaFin',
    'codigosCoche',
    'codigosBogie',
    'comentariosActividad',
    'tecnicos',
    'instrumentos',
    'ingMr',
    'responsableMantenimiento',
    'confianza',
    'filas',
    'advertencias',
  ],
  properties: {
    tipoFormato: {
      type: 'string',
      enum: ['UT-UF-MTO-FR-414', 'CONCAR', 'otro'],
    },
    trenNumero: { type: ['integer', 'null'] },
    kilometraje: { type: ['number', 'null'] },
    puestoTrabajo: { type: ['string', 'null'] },
    fecha: { type: ['string', 'null'] },
    horaInicio: { type: ['string', 'null'] },
    horaFin: { type: ['string', 'null'] },
    codigosCoche: {
      type: 'object',
      additionalProperties: false,
      required: ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2'],
      properties: {
        MA1: { type: ['integer', 'null'] },
        MB1: { type: ['integer', 'null'] },
        MB3: { type: ['integer', 'null'] },
        REM: { type: ['integer', 'null'] },
        MB2: { type: ['integer', 'null'] },
        MA2: { type: ['integer', 'null'] },
      },
    },
    codigosBogie: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipoCoche', 'tipoBogie', 'codigo'],
        properties: {
          tipoCoche: {
            type: 'string',
            enum: ['MA1', 'MB1', 'MB3', 'REM', 'MB2', 'MA2'],
          },
          tipoBogie: {
            type: 'string',
            enum: ['PB2', 'PB3', 'PB4', 'PB6', 'TB1', 'TB2'],
          },
          codigo: { type: ['string', 'null'] },
        },
      },
    },
    comentariosActividad: { type: ['string', 'null'] },
    tecnicos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['posicion', 'nombre', 'fecha', 'firmaCaja'],
        properties: {
          posicion: { type: 'integer', minimum: 1, maximum: 2 },
          nombre: { type: ['string', 'null'] },
          fecha: { type: ['string', 'null'] },
          firmaCaja: {
            type: ['array', 'null'],
            minItems: 4,
            maxItems: 4,
            items: { type: 'integer', minimum: 0, maximum: 1000 },
          },
        },
      },
    },
    instrumentos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'posicion',
          'codigo',
          'descripcion',
          'modeloMarca',
          'fechaCalibracion',
          'fechaVencimientoCalibracion',
          'observaciones',
        ],
        properties: {
          posicion: { type: 'integer', minimum: 1, maximum: 3 },
          codigo: { type: ['string', 'null'] },
          descripcion: { type: ['string', 'null'] },
          modeloMarca: { type: ['string', 'null'] },
          fechaCalibracion: { type: ['string', 'null'] },
          fechaVencimientoCalibracion: { type: ['string', 'null'] },
          observaciones: { type: ['string', 'null'] },
        },
      },
    },
    ingMr: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['nombre', 'fecha', 'firmaCaja'],
      properties: {
        nombre: { type: ['string', 'null'] },
        fecha: { type: ['string', 'null'] },
        firmaCaja: {
          type: ['array', 'null'],
          minItems: 4,
          maxItems: 4,
          items: { type: 'integer', minimum: 0, maximum: 1000 },
        },
      },
    },
    responsableMantenimiento: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['nombre', 'fecha', 'firmaCaja'],
      properties: {
        nombre: { type: ['string', 'null'] },
        fecha: { type: ['string', 'null'] },
        firmaCaja: {
          type: ['array', 'null'],
          minItems: 4,
          maxItems: 4,
          items: { type: 'integer', minimum: 0, maximum: 1000 },
        },
      },
    },
    confianza: { type: 'number', minimum: 0, maximum: 100 },
    filas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'ejeNumero',
          'lado',
          'tAntes',
          'hAntes',
          'tValue',
          'hValue',
          'rugosidadRa',
          'confianza',
        ],
        properties: {
          ejeNumero: { type: 'integer', minimum: 1, maximum: 24 },
          lado: { type: 'string', enum: ['izquierdo', 'derecho'] },
          tAntes: { type: 'number' },
          hAntes: { type: 'number' },
          tValue: { type: 'number' },
          hValue: { type: 'number' },
          rugosidadRa: { type: 'number' },
          confianza: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
    },
    advertencias: { type: 'array', items: { type: 'string' } },
  },
} as const;

@Injectable()
export class ReprofilingGeminiService {
  constructor(private readonly config: ConfigService) {}

  private obtenerEstado(error: unknown): number {
    if (typeof error === 'object' && error !== null && 'status' in error) {
      const estado = Number(error.status);
      if (Number.isFinite(estado)) return estado;
    }
    if (error instanceof Error) {
      const coincidencia = error.message.match(
        /(?:"code"\s*:\s*|\b)(429|503)\b/,
      );
      if (coincidencia) return Number(coincidencia[1]);
    }
    return 0;
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async extraerFirma(
    imagen: Buffer,
    caja: CajaFirma | null,
  ): Promise<string | null> {
    if (!caja) return null;
    const [yMin, xMin, yMax, xMax] = caja;
    if (xMax <= xMin || yMax <= yMin) return null;
    const metadata = await sharp(imagen).metadata();
    if (!metadata.width || !metadata.height) return null;
    const left = Math.max(0, Math.floor((xMin / 1000) * metadata.width));
    const top = Math.max(0, Math.floor((yMin / 1000) * metadata.height));
    const width = Math.min(
      metadata.width - left,
      Math.max(1, Math.ceil(((xMax - xMin) / 1000) * metadata.width)),
    );
    const height = Math.min(
      metadata.height - top,
      Math.max(1, Math.ceil(((yMax - yMin) / 1000) * metadata.height)),
    );
    const firma = await sharp(imagen)
      .extract({ left, top, width, height })
      .resize({
        width: 600,
        height: 180,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    return `data:image/png;base64,${firma.toString('base64')}`;
  }

  async leer(archivo: Express.Multer.File): Promise<ResultadoOcrReperfilado> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'La lectura manuscrita requiere configurar GEMINI_API_KEY en apps/api/.env y reiniciar el backend.',
      );
    }
    if (!archivo?.buffer?.length)
      throw new ServiceUnavailableException(
        'No se recibió ninguna fotografía.',
      );

    const imagen = await sharp(archivo.buffer)
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 94 })
      .toBuffer();
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `Analiza esta fotografía de una ficha ferroviaria de reperfilado. Puede estar inclinada, girada, recortada y contener escritura manuscrita azul.

Identifica primero el formato. Para UT-UF-MTO-FR-414, extrae N° de tren, kilometraje, P.T., fecha/hora de inicio y fecha/hora de fin. Extrae también los seis códigos numéricos escritos debajo de MA1, MB1, MB3, R/REM, MB2 y MA2. En la columna "Bogie / Código", extrae además el código manuscrito ubicado debajo de cada uno de los 12 bogies físicos y relaciónalo con coche y tipo de bogie; no confundas el tipo impreso PB2/PB3/PB4/PB6/TB1/TB2 con el código manuscrito. Usa null si un código no es legible. El P.T. es un código alfanumérico continuo, sin espacios ni guiones (por ejemplo: GZMF1844435); distingue cuidadosamente letras similares como Y/Z y no agregues separadores. En el pie extrae comentarios, hasta tres instrumentos, los dos técnicos, Ing. MR y Responsable de Mantenimiento. Para cada firma realmente visible devuelve firmaCaja como [yMin,xMin,yMax,xMax] en coordenadas normalizadas 0-1000 de toda la imagen; si no hay firma devuelve null. No confundas texto, líneas o sellos con una firma. Fechas en YYYY-MM-DD. En la tabla hay hasta 24 ejes y dos lados por eje. Por cada lado extrae los cinco valores visibles y legibles:
- tAntes = Espesor medido ANTES del reperfilado (mm)
- hAntes = Desgaste cóncavo / profundidad ANTES del reperfilado (mm)
- tValue = Espesor medido DESPUÉS del reperfilado (mm)
- hValue = Desgaste cóncavo / profundidad DESPUÉS del reperfilado (mm)
- rugosidadRa = Rugosidad R.A. final; para toda fila legible devuelve exactamente 2.5 (µm)
No confundas ANTES con DESPUÉS. R.A. es una medición independiente: no la calcules restando otros campos. Solo devuelve una fila cuando los cinco valores del lado sean legibles; no inventes filas tapadas, cortadas o vacías.

El lado izquierdo está a la izquierda del bloque central EJE/RUEDA/COCHE y el derecho a la derecha. Usa el número de EJE impreso en el centro para asignar cada fila. Convierte coma decimal a punto. Fecha en YYYY-MM-DD y horas en HH:mm. Confianza de 0 a 100 por fila. Agrega una advertencia específica por cada zona dudosa o recortada.`;

    try {
      let respuesta: Awaited<ReturnType<typeof ai.models.generateContent>>;
      for (let intento = 1; ; intento += 1) {
        try {
          respuesta = await ai.models.generateContent({
            model:
              this.config.get<string>('GEMINI_VISION_MODEL')?.trim() ||
              'gemini-3.5-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      data: imagen.toString('base64'),
                      mimeType: 'image/jpeg',
                    },
                  },
                ],
              },
            ],
            config: {
              temperature: 0,
              responseMimeType: 'application/json',
              responseJsonSchema: ESQUEMA_RESPUESTA,
            },
          });
          break;
        } catch (error) {
          if (this.obtenerEstado(error) !== 503 || intento >= 3) throw error;
          await this.esperar(intento * 1000);
        }
      }
      if (!respuesta.text) throw new Error('Gemini no devolvió datos.');
      const datos = JSON.parse(respuesta.text) as RespuestaGemini;
      const unicas = new Map(
        datos.filas.map((fila) => [`${fila.ejeNumero}|${fila.lado}`, fila]),
      );
      const advertencias = [...datos.advertencias];
      const codigosCoche = Object.fromEntries(
        Object.entries(datos.codigosCoche).filter(
          (entrada): entrada is [TipoCocheReperfilado, number] =>
            Number.isInteger(entrada[1]) && Number(entrada[1]) > 0,
        ),
      );
      const codigosBogie = Object.fromEntries(
        datos.codigosBogie
          .filter((item) => item.codigo?.trim())
          .map((item) => [
            `${item.tipoCoche}:${item.tipoBogie}`,
            item.codigo!.trim().toUpperCase(),
          ]),
      );
      const tecnicos = await Promise.all(
        datos.tecnicos.map(async ({ firmaCaja, ...tecnico }) => ({
          ...tecnico,
          firma: await this.extraerFirma(imagen, firmaCaja),
        })),
      );
      const aPersona = async (
        persona:
          (Omit<PersonaOcr, 'firma'> & { firmaCaja: CajaFirma | null }) | null,
      ): Promise<PersonaOcr | null> => {
        if (!persona) return null;
        const { firmaCaja, ...datosPersona } = persona;
        return {
          ...datosPersona,
          firma: await this.extraerFirma(imagen, firmaCaja),
        };
      };
      if (datos.tipoFormato !== 'UT-UF-MTO-FR-414') {
        advertencias.unshift(
          `La fotografía parece corresponder al formato ${datos.tipoFormato}, no a UT-UF-MTO-FR-414; revisa todos los campos.`,
        );
      }
      return {
        trenNumero: datos.trenNumero,
        kilometraje: datos.kilometraje,
        puestoTrabajo:
          datos.puestoTrabajo?.replace(/[^A-Z0-9]/gi, '').toUpperCase() || null,
        fecha: datos.fecha,
        horaInicio: datos.horaInicio,
        horaFin: datos.horaFin,
        codigosCoche,
        codigosBogie,
        comentariosActividad: datos.comentariosActividad,
        tecnicos,
        instrumentos: datos.instrumentos,
        ingMr: await aPersona(datos.ingMr),
        responsableMantenimiento: await aPersona(
          datos.responsableMantenimiento,
        ),
        confianza: datos.confianza,
        filas: [...unicas.values()].map((fila) => ({
          ...fila,
          rugosidadRa: 2.5,
        })),
        advertencias,
        textoReconocido: `Gemini Vision: ${datos.tipoFormato}`,
      };
    } catch (error) {
      const estado = this.obtenerEstado(error);
      if (estado === 429) {
        throw new ServiceUnavailableException(
          'Gemini está configurado, pero la cuota disponible fue excedida. Revisa la facturación o los límites del proyecto de Google.',
        );
      }
      if (estado === 503) {
        throw new ServiceUnavailableException(
          'Gemini está temporalmente saturado. Se intentó leer la fotografía tres veces; vuelve a intentarlo en unos minutos o usa Registrar manualmente.',
        );
      }
      const mensaje =
        error instanceof Error ? error.message : 'Error desconocido';
      throw new BadGatewayException(
        `Gemini no pudo leer la fotografía: ${mensaje}`,
      );
    }
  }
}
