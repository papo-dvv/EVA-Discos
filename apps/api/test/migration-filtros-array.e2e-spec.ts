import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Reproduce end-to-end el bug de "property estado[] should not exist": con el
// parser de query 'simple' (default de Express 5), un array en el querystring
// llega a Nest con la clave literal "estado[]" en vez de "estado", y el
// ValidationPipe (whitelist:true) lo rechaza con 400. Requiere pasar por HTTP
// real — un test unitario del DTO/servicio no toca el parser de Express.
describe('Migration — filtros con array en querystring (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const EMAIL = 'e2e-filtros-array@eva-l1.local';
  const PASSWORD = 'ClaveE2eFiltros123';
  const DNI = '90000003';
  let token: string;
  let fileId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = await moduleFixture.createNestApplication<NestExpressApplication>();
    // Misma config que main.ts (el test bootstrapea su propia app, no invoca
    // main.ts directamente — igual que el resto de los *.e2e-spec.ts de este
    // proyecto, que ya replican el ValidationPipe en vez de importar bootstrap()).
    app.set('query parser', 'extended');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { email: EMAIL } });

    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const admin = await prisma.user.create({
      data: {
        nombresCompletos: 'Admin E2E Filtros Array',
        dni: DNI,
        area: 'QA',
        rol: 'administrador',
        empresa: 'EVA',
        email: EMAIL,
        passwordHash,
        estadoCuenta: 'activo',
        debeCambiarPassword: false,
      },
    });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    token = login.body.accessToken as string;

    const file = await prisma.uploadedFile.create({
      data: {
        filename: 'FIXTURE-e2e-filtros-array.xlsx',
        tipoCarga: 'migracion_masiva_excel',
        uploadedBy: admin.id,
        status: 'review',
        totalRows: 4,
        validRows: 4,
        invalidRows: 0,
      },
    });
    fileId = file.id;

    const base = {
      fileId,
      responsableNombre: 'E2E',
      trenNumero: 6,
      kilometraje: 100000,
      fecha: new Date('2024-01-01'),
      motivo: 'Medición',
      tValue: 12,
    };
    await prisma.scanRecord.createMany({
      data: [
        { ...base, hValue: 3, rdValue: 9, estadoCalculado: 'OK' },
        { ...base, hValue: 11.3, rdValue: 0.7, estadoCalculado: 'SEGUIMIENTO' },
        { ...base, hValue: 11.7, rdValue: 0.3, estadoCalculado: 'CAMBIO' },
        { ...base, hValue: 12.5, rdValue: -0.5, estadoCalculado: 'CRITICO' },
      ],
    });
  });

  afterAll(async () => {
    await prisma.uploadedFile.deleteMany({ where: { id: fileId } }); // cascade
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
  });

  it('GET /preview?estado=SEGUIMIENTO&estado=CAMBIO (repetido, sin corchetes) responde 200 con ambos aplicados', async () => {
    const res = await request(app.getHttpServer())
      .get(`/migration/${fileId}/preview?estado=SEGUIMIENTO&estado=CAMBIO`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.total).toBe(2);
    const estados = (res.body.rows as { estadoCalculado: string }[])
      .map((r) => r.estadoCalculado)
      .sort();
    expect(estados).toEqual(['CAMBIO', 'SEGUIMIENTO']);
  });

  it('GET /preview?estado[]=SEGUIMIENTO&estado[]=CAMBIO (formato bracket) también responde 200', async () => {
    const res = await request(app.getHttpServer())
      .get(`/migration/${fileId}/preview?estado[]=SEGUIMIENTO&estado[]=CAMBIO`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.total).toBe(2);
  });

  it('GET /stats?estado=SEGUIMIENTO&estado=CAMBIO responde 200 con el mismo filtro aplicado (mismo DTO que /preview)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/migration/${fileId}/stats?estado=SEGUIMIENTO&estado=CAMBIO`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.filtrado).toEqual({
      ok: 0,
      seguimiento: 1,
      cambio: 1,
      critico: 0,
    });
    expect(res.body.total).toEqual({
      ok: 1,
      seguimiento: 1,
      cambio: 1,
      critico: 1,
    });
    // totalFilasSubidas ignora el filtro: son las 4 filas de la carga.
    expect(res.body.totalFilasSubidas).toBe(4);
  });

  it('un solo valor (?estado=CRITICO, sin array) sigue funcionando igual que antes', async () => {
    const res = await request(app.getHttpServer())
      .get(`/migration/${fileId}/preview?estado=CRITICO`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.total).toBe(1);
  });
});
