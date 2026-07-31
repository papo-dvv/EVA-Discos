import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Reproduce end-to-end el bug diagnosticado: reenviar la MISMA contraseña
// temporal en /auth/change-password no debía "completar" el cambio
// obligatorio. Usa un usuario descartable (nunca el admin real) para no
// interferir con el estado compartido de la base de desarrollo.
describe('Auth — cambio de contraseña obligatorio (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const EMAIL = 'e2e-cambio-password@eva-l1.local';
  const DNI = '90000001';
  const TEMP_PASSWORD = 'TempClave123';
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mismo ValidationPipe que main.ts, para que el DTO se comporte igual.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);

    // Limpieza defensiva por si una corrida previa quedó a medias.
    await prisma.user.deleteMany({ where: { email: EMAIL } });

    const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 12);
    const usuario = await prisma.user.create({
      data: {
        nombresCompletos: 'Usuario E2E Cambio Password',
        dni: DNI,
        area: 'QA',
        rol: 'tecnico_medicion',
        empresa: 'EVA',
        email: EMAIL,
        passwordHash,
        estadoCuenta: 'activo',
        debeCambiarPassword: true,
      },
    });
    userId = usuario.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
  });

  it('reenviar la MISMA contraseña temporal responde 400 y deja debe_cambiar_password en true', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: TEMP_PASSWORD })
      .expect(200);

    expect(login.body.forzarCambioPassword).toBe(true);
    const token: string = login.body.accessToken;

    const cambio = await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: TEMP_PASSWORD })
      .expect(400);

    expect(cambio.body.message).toMatch(/no puede ser igual a la actual/i);

    const usuario = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(usuario.debeCambiarPassword).toBe(true);

    // La contraseña temporal sigue siendo la vigente: nada cambió.
    const login2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: TEMP_PASSWORD })
      .expect(200);
    expect(login2.body.forzarCambioPassword).toBe(true);
  });

  it('caso positivo: una contraseña distinta cambia correctamente y apaga el flag', async () => {
    // Continúa desde el estado del test anterior: sigue con la temporal.
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: TEMP_PASSWORD })
      .expect(200);

    const token: string = login.body.accessToken;
    const NUEVA_PASSWORD = 'ClaveDefinitiva456';

    await request(app.getHttpServer())
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ newPassword: NUEVA_PASSWORD })
      .expect(200);

    const usuario = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(usuario.debeCambiarPassword).toBe(false);

    // La temporal ya no sirve.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: TEMP_PASSWORD })
      .expect(401);

    // La nueva sí, y ya sin forzar cambio.
    const login2 = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: NUEVA_PASSWORD })
      .expect(200);
    expect(login2.body.forzarCambioPassword).toBe(false);
  });
});
