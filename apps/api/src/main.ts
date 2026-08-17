import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Express 5 usa por defecto el parser 'simple' (módulo nativo querystring),
  // que NO entiende corchetes: "?estado[]=OK&estado[]=CRITICO" llega como una
  // clave literal "estado[]" (no como "estado" con array), y el ValidationPipe
  // con whitelist:true la rechaza con 400 "property estado[] should not
  // exist". 'extended' usa la librería `qs`, que sí interpreta ese formato
  // (y también "estado=OK&estado=CRITICO" repetido) como { estado: [...] }.
  app.set('query parser', 'extended');
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173' });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
