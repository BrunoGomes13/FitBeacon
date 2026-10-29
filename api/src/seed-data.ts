import bcrypt from 'bcryptjs';
import type { AppConfig } from './config.js';
import {
  Area,
  Equipment,
  Exercise,
  Gym,
  SetLog,
  UsageSession,
  User,
} from './models/index.js';

const exerciseFixtures = [
  ['Agachamento livre', 'Quadríceps'],
  ['Leg press', 'Quadríceps'],
  ['Cadeira extensora', 'Quadríceps'],
  ['Mesa flexora', 'Posterior de coxa'],
  ['Levantamento terra romeno', 'Posterior de coxa'],
  ['Elevação pélvica', 'Glúteos'],
  ['Supino reto', 'Peitoral'],
  ['Supino inclinado', 'Peitoral'],
  ['Puxada frontal', 'Costas'],
  ['Remada baixa', 'Costas'],
  ['Desenvolvimento de ombros', 'Ombros'],
  ['Elevação lateral', 'Ombros'],
  ['Rosca direta', 'Bíceps'],
  ['Rosca martelo', 'Bíceps'],
  ['Tríceps na polia', 'Tríceps'],
  ['Prancha', 'Abdômen'],
  ['Abdominal na máquina', 'Abdômen'],
  ['Corrida na esteira', 'Cardiorrespiratório'],
  ['Bicicleta ergométrica', 'Cardiorrespiratório'],
  ['Remo ergométrico', 'Cardiorrespiratório'],
] as const;

const areaFixtures = ['Membros inferiores', 'Membros superiores', 'Cardio', 'Funcional'];
const gymBeaconUuid = '00000000-0000-4000-8000-000000000001';

const equipmentFixtures = [
  ['Leg press 45°', 0],
  ['Cadeira extensora', 0],
  ['Mesa flexora', 0],
  ['Supino guiado', 1],
  ['Puxador frontal', 1],
  ['Remada sentada', 1],
  ['Esteira 01', 2],
  ['Bicicleta vertical', 2],
  ['Remo ergométrico', 2],
  ['Estação de cabos', 3],
  ['Banco regulável', 3],
  ['Smith machine', 3],
] as const;

function beaconUuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}`;
}

export async function seedData(
  config: AppConfig,
): Promise<{ gymId: string; sessions: number }> {
  const gym = await Gym.findOneAndUpdate(
    { slug: 'fitbeacon-demo' },
    { $setOnInsert: { name: 'Academia FitBeacon Demo', slug: 'fitbeacon-demo' } },
    { upsert: true, returnDocument: 'after' },
  );
  const [adminPasswordHash, studentPasswordHash] = await Promise.all([
    bcrypt.hash(config.SEED_ADMIN_PASSWORD, 12),
    bcrypt.hash(config.SEED_STUDENT_PASSWORD, 12),
  ]);
  await User.findOneAndUpdate(
    { email: config.SEED_ADMIN_EMAIL },
    {
      $set: {
        gymId: gym._id,
        name: 'Admin FitBeacon',
        passwordHash: adminPasswordHash,
        role: 'admin',
        consentTracking: true,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  const student = await User.findOneAndUpdate(
    { email: config.SEED_STUDENT_EMAIL },
    {
      $set: {
        gymId: gym._id,
        name: 'Aluno de demonstração',
        passwordHash: studentPasswordHash,
        role: 'student',
        consentTracking: true,
      },
    },
    { upsert: true, returnDocument: 'after', runValidators: true },
  );
  const areas = await Promise.all(
    areaFixtures.map((name) =>
      Area.findOneAndUpdate(
        { gymId: gym._id, name },
        { $setOnInsert: { gymId: gym._id, name, description: `Área ${name}` } },
        { upsert: true, returnDocument: 'after' },
      ),
    ),
  );
  const exercises = await Promise.all(
    exerciseFixtures.map(([name, muscleGroup], index) =>
      Exercise.findOneAndUpdate(
        { gymId: gym._id, name },
        {
          $setOnInsert: {
            gymId: gym._id,
            name,
            muscleGroup,
            steps: [
              'Ajuste o equipamento para sua altura e posição.',
              'Execute o movimento com controle e postura estável.',
              'Retorne à posição inicial sem soltar a carga.',
            ],
            commonMistakes: [
              'Usar impulso durante o movimento.',
              'Não controlar a fase de retorno.',
            ],
            media: {},
            recommendedSets: 3 + (index % 2),
            recommendedReps: 8 + (index % 5),
            isActive: true,
          },
        },
        { upsert: true, returnDocument: 'after' },
      ),
    ),
  );
  const equipment = await Promise.all(
    equipmentFixtures.map(([name, areaIndex], index) => {
      const equipmentExercises = [
        exercises[index % exercises.length],
        exercises[(index + 1) % exercises.length],
      ];

      return Equipment.findOneAndUpdate(
        {
          gymId: gym._id,
          'beacon.major': 1,
          'beacon.minor': index + 1,
        },
        {
          $set: {
            beacon: {
              uuid: gymBeaconUuid,
              major: 1,
              minor: index + 1,
              txPower: -59,
              rssiEnter: -65,
              rssiExit: -75,
            },
          },
          $setOnInsert: {
            gymId: gym._id,
            areaId: areas[areaIndex]._id,
            name,
            adjustments: [
              {
                name: 'Posição inicial',
                instructions: 'Ajuste o banco e os apoios antes de começar.',
              },
              {
                name: 'Carga',
                instructions: 'Selecione uma carga que permita movimentos controlados.',
              },
            ],
            exerciseIds: equipmentExercises.map((exercise) => exercise._id),
            media: {},
            isActive: true,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
    }),
  );

  const now = new Date();
  let insertedSessions = 0;

  for (let day = 0; day < 30; day += 1) {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - 30 + day);

    for (let equipmentIndex = 0; equipmentIndex < equipment.length; equipmentIndex += 1) {
      const currentEquipment = equipment[equipmentIndex];
      const hour = 6 + ((day * 3 + equipmentIndex * 2) % 15);
      const startedAt = new Date(
        Date.UTC(
          date.getUTCFullYear(),
          date.getUTCMonth(),
          date.getUTCDate(),
          hour,
          (equipmentIndex * 7) % 60,
        ),
      );
      const durationSec = 600 + ((day * 97 + equipmentIndex * 173) % 2400);
      const endedAt = new Date(startedAt.getTime() + durationSec * 1000);
      const clientSessionId = beaconUuid((day + 1) * 100 + equipmentIndex + 1);
      const session = await UsageSession.findOneAndUpdate(
        { clientSessionId },
        {
          $setOnInsert: {
            clientSessionId,
            userId: student._id,
            equipmentId: currentEquipment._id,
            areaId: currentEquipment.areaId,
            startedAt,
            endedAt,
            durationSec,
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
      insertedSessions += 1;

      const exerciseId =
        currentEquipment.exerciseIds[day % currentEquipment.exerciseIds.length];
      await SetLog.findOneAndUpdate(
        { sessionId: session._id, exerciseId, setNumber: 1 },
        {
          $setOnInsert: {
            sessionId: session._id,
            exerciseId,
            setNumber: 1,
            load: 20 + ((equipmentIndex * 5 + day) % 80),
            reps: 8 + ((day + equipmentIndex) % 5),
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
    }
  }

  return { gymId: gym._id.toString(), sessions: insertedSessions };
}
