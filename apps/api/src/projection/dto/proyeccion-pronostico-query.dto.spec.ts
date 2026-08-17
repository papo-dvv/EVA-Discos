// Los decoradores de class-validator/class-transformer (@Type, @IsIn, etc.)
// dependen de reflect-metadata para leer el tipo de cada propiedad — NestJS
// lo importa implícitamente al arrancar la app real, pero un test que
// instancia el DTO de forma aislada (sin bootstrapear Nest) necesita
// importarlo de forma explícita, antes de cargar el DTO.
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProyeccionPronosticoQueryDto } from './proyeccion-pronostico-query.dto';

// Test liviano de la validación del DTO (sin levantar un app Nest completa):
// meses es una lista CERRADA de valores permitidos (12/24/36/48/60, punto 2
// del enunciado) — cualquier otro entero se rechaza. El ValidationPipe global
// (whitelist:true, transform:true, ver main.ts) es quien traduce estos
// errores de class-validator a un 400 real por HTTP; acá solo se prueba que
// el DTO en sí mismo produce (o no) esos errores.
describe('ProyeccionPronosticoQueryDto', () => {
  it('sin meses en la query, default a 12', async () => {
    const dto = plainToInstance(ProyeccionPronosticoQueryDto, {});
    const errores = await validate(dto);

    expect(errores).toHaveLength(0);
    expect(dto.meses).toBe(12);
  });

  it.each([12, 24, 36, 48, 60, 77])(
    'meses=%i (valor permitido) pasa la validación',
    async (valor) => {
      const dto = plainToInstance(ProyeccionPronosticoQueryDto, {
        meses: String(valor),
      });
      const errores = await validate(dto);

      expect(errores).toHaveLength(0);
      expect(dto.meses).toBe(valor);
    },
  );

  it('meses=15 (valor no permitido) falla la validación', async () => {
    const dto = plainToInstance(ProyeccionPronosticoQueryDto, { meses: '15' });
    const errores = await validate(dto);

    expect(errores.length).toBeGreaterThan(0);
    expect(errores[0].property).toBe('meses');
  });

  it('meses no numérico falla la validación', async () => {
    const dto = plainToInstance(ProyeccionPronosticoQueryDto, {
      meses: 'abc',
    });
    const errores = await validate(dto);

    expect(errores.length).toBeGreaterThan(0);
  });

  it('tren se transforma a número', async () => {
    const dto = plainToInstance(ProyeccionPronosticoQueryDto, { tren: '32' });
    const errores = await validate(dto);

    expect(errores).toHaveLength(0);
    expect(dto.tren).toBe(32);
  });
});
