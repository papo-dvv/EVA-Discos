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
  confianza: number;
  filas: Array<{
    ejeNumero: number;
    lado: 'izquierdo' | 'derecho';
    tValue: number;
    hValue: number;
    rugosidadRa: number | null;
    confianza: number;
  }>;
  advertencias: string[];
  textoReconocido: string;
}

type RespuestaGemini = {
  tipoFormato: 'UT-UF-MTO-FR-414' | 'CONCAR' | 'otro';
  trenNumero: number | null;
  kilometraje: number | null;
  puestoTrabajo: string | null;
  fecha: string | null;
  horaInicio: string | null;
  horaFin: string | null;
  confianza: number;
  filas: Array<{
    ejeNumero: number;
    lado: 'izquierdo' | 'derecho';
    tValue: number;
    hValue: number;
    rugosidadRa: number | null;
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
    confianza: { type: 'number', minimum: 0, maximum: 100 },
    filas: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'ejeNumero',
          'lado',
          'tValue',
          'hValue',
          'rugosidadRa',
          'confianza',
        ],
        properties: {
          ejeNumero: { type: 'integer', minimum: 1, maximum: 24 },
          lado: { type: 'string', enum: ['izquierdo', 'derecho'] },
          tValue: { type: 'number' },
          hValue: { type: 'number' },
          rugosidadRa: { type: ['number', 'null'] },
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
      const coincidencia = error.message.match(/(?:"code"\s*:\s*|\b)(429|503)\b/);
      if (coincidencia) return Number(coincidencia[1]);
    }
    return 0;
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

Identifica primero el formato. Para UT-UF-MTO-FR-414, extrae N° de tren, kilometraje, P.T., fecha/hora de inicio y fecha/hora de fin. El P.T. es un código alfanumérico continuo, sin espacios ni guiones (por ejemplo: GZMF1844435); distingue cuidadosamente letras similares como Y/Z y no agregues separadores. En la tabla hay hasta 24 ejes y dos lados por eje. Extrae únicamente valores visibles y legibles de DESPUÉS DEL REPERFILADO:
- tValue = Espesor medido (mm)
- hValue = Desgaste cóncavo / profundidad (mm)
- rugosidadRa = Rugosidad Ra (µm), la última columna de cada lado; es un valor independiente y nunca debe calcularse restando otros campos
No confundas las columnas ANTES con DESPUÉS. No uses Rugosidad Ra como hValue. No inventes filas tapadas, cortadas o vacías. Si T y H son legibles pero Ra está vacío o ilegible, usa null.

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
        confianza: datos.confianza,
        filas: [...unicas.values()],
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
