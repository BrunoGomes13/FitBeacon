import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getConfig } from '../src/config.js';
import {
  Area,
  Equipment,
  Exercise,
  Gym,
  initializeModels,
  SetLog,
  UsageSession,
  User,
} from '../src/models/index.js';
import { seedData } from '../src/seed-data.js';

process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-for-fitbeacon-api-12345';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-for-fitbeacon-api-12345';
process.env.CORS_ORIGINS = 'http://localhost:5173';
process.env.LOGIN_RATE_LIMIT_MAX = '100';

jest.setTimeout(180_000);

let mongoServer: MongoMemoryServer;
let app: Express;
let gymId: mongoose.Types.ObjectId;
let areaId: mongoose.Types.ObjectId;
let equipmentId: mongoose.Types.ObjectId;
let secondEquipmentId: mongoose.Types.ObjectId;
let exerciseId: mongoose.Types.ObjectId;
let studentId: mongoose.Types.ObjectId;

const beacon = {
  uuid: 'b6f2d3b0-2a7c-4c52-8e90-02bd52100001',
  major: 12,
  minor: 34,
  txPower: -59,
  rssiEnter: -65,
  rssiExit: -75,
};

async function login(email: string, password: string): Promise<string> {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password });

  expect(response.status).toBe(200);
  return response.body.accessToken as string;
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();
  await mongoose.connect(mongoServer.getUri());
  await initializeModels();
  app = createApp(getConfig());
});

beforeEach(async () => {
  await Promise.all(
    Object.values(mongoose.connection.collections).map((collection) =>
      collection.deleteMany({}),
    ),
  );

  const gym = await Gym.create({ name: 'Academia de teste', slug: 'academia-teste' });
  gymId = gym._id;
  const area = await Area.create({ gymId, name: 'Musculação', isActive: true });
  areaId = area._id;
  const exercise = await Exercise.create({
    gymId,
    name: 'Agachamento',
    muscleGroup: 'Quadríceps',
    steps: ['Posicione os pés', 'Desça com controle'],
    commonMistakes: ['Perder o alinhamento dos joelhos'],
    recommendedSets: 3,
    recommendedReps: 10,
    isActive: true,
  });
  exerciseId = exercise._id;
  const equipment = await Equipment.create({
    gymId,
    areaId,
    name: 'Leg press',
    beacon,
    exerciseIds: [exerciseId],
    isActive: true,
  });
  equipmentId = equipment._id;
  const secondEquipment = await Equipment.create({
    gymId,
    areaId,
    name: 'Cadeira extensora',
    beacon: { ...beacon, minor: beacon.minor + 1 },
    exerciseIds: [exerciseId],
    isActive: true,
  });
  secondEquipmentId = secondEquipment._id;
  const passwordHash = await bcrypt.hash('Senha-Forte-Teste-2026!', 4);
  await User.create({
    gymId,
    name: 'Admin de teste',
    email: 'admin@example.test',
    passwordHash,
    role: 'admin',
    consentTracking: true,
  });
  const student = await User.create({
    gymId,
    name: 'Aluno de teste',
    email: 'student@example.test',
    passwordHash,
    role: 'student',
    consentTracking: true,
  });
  studentId = student._id;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('autenticação', () => {
  it('informa prontidão da API com o MongoDB conectado', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', database: 'connected' });
  });

  it('registra alunos, autentica, consulta perfil, renova e revoga refresh token', async () => {
    const registration = await request(app).post('/api/v1/auth/register').send({
      name: 'Novo aluno',
      email: 'novo@example.test',
      password: 'Uma-Senha-Forte-2026!',
      gymId: gymId.toString(),
      consentTracking: true,
      role: 'admin',
    });

    expect(registration.status).toBe(201);
    expect(registration.body.user.role).toBe('student');
    expect(registration.body.user).not.toHaveProperty('passwordHash');

    const loginResponse = await request(app).post('/api/v1/auth/login').send({
      email: 'novo@example.test',
      password: 'Uma-Senha-Forte-2026!',
    });
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.user).not.toHaveProperty('passwordHash');

    const accessToken = loginResponse.body.accessToken as string;
    const profile = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(profile.status).toBe(200);
    expect(profile.body.user.email).toBe('novo@example.test');
    expect(profile.body.user).not.toHaveProperty('passwordHash');

    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: loginResponse.body.refreshToken });
    expect(refresh.status).toBe(200);
    expect(refresh.body.refreshToken).not.toBe(loginResponse.body.refreshToken);

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refresh.body.accessToken}`)
      .send({ refreshToken: refresh.body.refreshToken });
    expect(logout.status).toBe(204);

    const revokedRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refresh.body.refreshToken });
    expect(revokedRefresh.status).toBe(401);
  });

  it('rejeita credenciais inválidas e entradas fora do schema', async () => {
    const badLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'e-mail inválido',
      password: 'errada',
    });
    expect(badLogin.status).toBe(400);
    expect(badLogin.body).toMatchObject({ code: 'VALIDATION_ERROR' });

    const badCredentials = await request(app).post('/api/v1/auth/login').send({
      email: 'student@example.test',
      password: 'senha incorreta',
    });
    expect(badCredentials.status).toBe(401);
    expect(badCredentials.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});

describe('busca por beacon', () => {
  it('retorna o equipamento e exercícios correspondentes ao beacon', async () => {
    const token = await login('student@example.test', 'Senha-Forte-Teste-2026!');
    const response = await request(app)
      .get('/api/v1/equipment/beacon')
      .query({ uuid: beacon.uuid, major: beacon.major, minor: beacon.minor })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.name).toBe('Leg press');
    expect(response.body.data.areaId.name).toBe('Musculação');
    expect(response.body.data.exerciseIds[0].name).toBe('Agachamento');

    const missing = await request(app)
      .get('/api/v1/equipment/beacon')
      .query({ uuid: beacon.uuid, major: beacon.major, minor: 99 })
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe('EQUIPMENT_NOT_FOUND');
  });

  it('respeita a revogação de consentimento de rastreamento', async () => {
    const token = await login('student@example.test', 'Senha-Forte-Teste-2026!');
    const consent = await request(app)
      .patch('/api/v1/auth/me/consent')
      .set('Authorization', `Bearer ${token}`)
      .send({ consentTracking: false });
    expect(consent.status).toBe(200);
    expect(consent.body.user.consentTracking).toBe(false);

    const beaconLookup = await request(app)
      .get('/api/v1/equipment/beacon')
      .query({ uuid: beacon.uuid, major: beacon.major, minor: beacon.minor })
      .set('Authorization', `Bearer ${token}`);
    expect(beaconLookup.status).toBe(403);
    expect(beaconLookup.body.code).toBe('TRACKING_CONSENT_REQUIRED');
  });
});

describe('CRUD administrativo', () => {
  it('cria, atualiza e desativa áreas, exercícios e equipamentos', async () => {
    const token = await login('admin@example.test', 'Senha-Forte-Teste-2026!');
    const headers = { Authorization: `Bearer ${token}` };
    const area = await request(app)
      .post('/api/v1/admin/areas')
      .set(headers)
      .send({ name: 'Sala de teste' });
    expect(area.status).toBe(201);

    const exercise = await request(app)
      .post('/api/v1/admin/exercises')
      .set(headers)
      .send({
        name: 'Remada curvada',
        muscleGroup: 'Costas',
        steps: ['Segure a barra', 'Puxe com controle'],
        recommendedSets: 3,
        recommendedReps: 10,
      });
    expect(exercise.status).toBe(201);

    const equipment = await request(app)
      .post('/api/v1/admin/equipment')
      .set(headers)
      .send({
        areaId: area.body.data._id,
        name: 'Remada baixa',
        beacon: {
          ...beacon,
          minor: beacon.minor + 10,
        },
        exerciseIds: [exercise.body.data._id],
      });
    expect(equipment.status).toBe(201);

    const update = await request(app)
      .patch(`/api/v1/admin/equipment/${equipment.body.data._id}`)
      .set(headers)
      .send({ name: 'Remada baixa guiada' });
    expect(update.status).toBe(200);
    expect(update.body.data.name).toBe('Remada baixa guiada');

    const removeArea = await request(app)
      .delete(`/api/v1/admin/areas/${area.body.data._id}`)
      .set(headers);
    expect(removeArea.status).toBe(204);
    expect(
      await Equipment.findById(equipment.body.data._id).then(
        (document) => document?.isActive,
      ),
    ).toBe(false);
  });
});

describe('sessões em lote', () => {
  it('deduplica sessões repetidas no lote e torna reenvios idempotentes', async () => {
    const token = await login('student@example.test', 'Senha-Forte-Teste-2026!');
    const session = {
      clientSessionId: randomUUID(),
      equipmentId: equipmentId.toString(),
      areaId: areaId.toString(),
      startedAt: '2026-10-25T10:00:00.000Z',
      endedAt: '2026-10-25T10:30:00.000Z',
      sets: [{ exerciseId: exerciseId.toString(), setNumber: 1, load: 35, reps: 10 }],
    };

    const first = await request(app)
      .post('/api/v1/sessions/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessions: [session, session] });

    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({ created: 1, idempotent: 1 });
    expect(
      await UsageSession.countDocuments({ clientSessionId: session.clientSessionId }),
    ).toBe(1);
    expect(await SetLog.countDocuments()).toBe(1);

    const retry = await request(app)
      .post('/api/v1/sessions/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessions: [session] });
    expect(retry.status).toBe(201);
    expect(retry.body).toMatchObject({ created: 0, idempotent: 1 });
    expect(await UsageSession.countDocuments()).toBe(1);
    expect(await SetLog.countDocuments()).toBe(1);
  });

  it('recusa reutilizar clientSessionId com conteúdo conflitante', async () => {
    const token = await login('student@example.test', 'Senha-Forte-Teste-2026!');
    const first = {
      clientSessionId: randomUUID(),
      equipmentId: equipmentId.toString(),
      areaId: areaId.toString(),
      startedAt: '2026-10-25T10:00:00.000Z',
      endedAt: '2026-10-25T10:30:00.000Z',
      sets: [],
    };
    const conflicting = { ...first, equipmentId: secondEquipmentId.toString() };

    const response = await request(app)
      .post('/api/v1/sessions/batch')
      .set('Authorization', `Bearer ${token}`)
      .send({ sessions: [first, conflicting] });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(await UsageSession.countDocuments()).toBe(0);
  });
});

describe('relatórios administrativos', () => {
  beforeEach(async () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 60 * 60 * 1000);
    await UsageSession.create([
      {
        clientSessionId: randomUUID(),
        userId: studentId,
        equipmentId,
        areaId,
        startedAt: recent,
        endedAt: new Date(recent.getTime() + 600_000),
        durationSec: 600,
      },
      {
        clientSessionId: randomUUID(),
        userId: studentId,
        equipmentId,
        areaId,
        startedAt: new Date(recent.getTime() + 900_000),
        endedAt: new Date(recent.getTime() + 1_800_000),
        durationSec: 900,
      },
    ]);
  });

  it('agrega uso por equipamento e área e calcula média e ociosos', async () => {
    const token = await login('admin@example.test', 'Senha-Forte-Teste-2026!');
    const usage = await request(app)
      .get('/api/v1/reports/usage')
      .query({ groupBy: 'equipment' })
      .set('Authorization', `Bearer ${token}`);

    expect(usage.status).toBe(200);
    expect(usage.body.data[0]).toMatchObject({
      _id: equipmentId.toString(),
      name: 'Leg press',
      sessions: 2,
      totalDurationSec: 1500,
    });

    const summary = await request(app)
      .get('/api/v1/reports/summary')
      .query({ idleDays: 7 })
      .set('Authorization', `Bearer ${token}`);
    expect(summary.status).toBe(200);
    expect(summary.body.totals).toMatchObject({
      sessions: 2,
      totalDurationSec: 1500,
      averageDurationSec: 750,
    });
    expect(summary.body.rankings.areas[0].name).toBe('Musculação');
    expect(
      summary.body.idleEquipment.equipment.map((item: { id: string }) => item.id),
    ).toContain(secondEquipmentId.toString());
  });

  it('inclui alunos ativos e ocupação e filtra relatórios e mapa de calor', async () => {
    const token = await login('admin@example.test', 'Senha-Forte-Teste-2026!');
    const from = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const to = new Date(Date.now() + 60_000).toISOString();
    const headers = { Authorization: 'Bearer ' + token };
    const summary = await request(app)
      .get('/api/v1/reports/summary')
      .query({ from, to })
      .set(headers);

    expect(summary.status).toBe(200);
    expect(summary.body.totals.activeStudents).toBe(1);
    expect(summary.body.totals.occupancyRate).toBeGreaterThan(0);

    const filteredUsage = await request(app)
      .get('/api/v1/reports/usage')
      .query({ from, to, groupBy: 'equipment', equipmentId: equipmentId.toString() })
      .set(headers);
    expect(filteredUsage.status).toBe(200);
    expect(filteredUsage.body.data).toHaveLength(1);
    expect(filteredUsage.body.data[0]._id).toBe(equipmentId.toString());

    const heatmap = await request(app)
      .get('/api/v1/reports/heatmap')
      .query({ from, to, areaId: areaId.toString() })
      .set(headers);
    expect(heatmap.status).toBe(200);
    expect(heatmap.body.data).toHaveLength(1);
    expect(heatmap.body.data[0]).toMatchObject({
      areaId: areaId.toString(),
      areaName: 'Musculação',
      sessions: 2,
      totalDurationSec: 1500,
    });
  });

  it('exporta dados por hora em CSV e bloqueia relatórios de alunos', async () => {
    const adminToken = await login('admin@example.test', 'Senha-Forte-Teste-2026!');
    const csv = await request(app)
      .get('/api/v1/reports/export.csv')
      .query({ groupBy: 'hour' })
      .set('Authorization', 'Bearer ' + adminToken);
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('"identificador"');
    expect(csv.text).toContain('"duracao_total_segundos"');

    const studentToken = await login('student@example.test', 'Senha-Forte-Teste-2026!');
    const forbidden = await request(app)
      .get('/api/v1/reports/summary')
      .set('Authorization', 'Bearer ' + studentToken);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
  });
});

describe('seed de demonstração', () => {
  it('cria os dados iniciais e pode ser executado novamente sem duplicar registros', async () => {
    const config = getConfig();
    const first = await seedData(config);
    const second = await seedData(config);

    expect(second.gymId).toBe(first.gymId);
    expect(await Area.countDocuments({ gymId: first.gymId })).toBe(4);
    expect(await Equipment.countDocuments({ gymId: first.gymId })).toBe(12);
    expect(await Exercise.countDocuments({ gymId: first.gymId })).toBe(20);
    expect(await UsageSession.countDocuments()).toBe(360);
    expect(await SetLog.countDocuments()).toBe(360);
    expect(
      await Equipment.distinct('beacon.uuid', { gymId: first.gymId }),
    ).toEqual(['00000000-0000-4000-8000-000000000001']);
  });
});
