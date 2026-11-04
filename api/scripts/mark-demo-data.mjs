import mongoose from 'mongoose';
import { getConfig } from '../src/config.ts';
import {
  Area,
  Equipment,
  Exercise,
  Gym,
  SetLog,
  UsageSession,
  User,
  initializeModels,
} from '../src/models/index.ts';
import {
  areaFixtures,
  beaconUuid,
  equipmentFixtures,
  exerciseFixtures,
  gymBeaconUuid,
} from '../src/seed-data.ts';

async function markDemoData() {
  const config = getConfig();
  await mongoose.connect(config.MONGODB_URI);
  try {
    await initializeModels();
    const gym = await Gym.findOne({ slug: 'fitbeacon-demo' }).select('_id');
    if (!gym) {
      console.info('Academia de demonstração não encontrada; nenhum documento foi alterado.');
      return;
    }

    const gymResult = await Gym.updateOne({ _id: gym._id }, { $set: { isDemo: true } });
    const users = await User.find({
      gymId: gym._id,
      email: { $in: [config.SEED_ADMIN_EMAIL.toLowerCase(), config.SEED_STUDENT_EMAIL.toLowerCase()] },
    }).select('_id');
    const userIds = users.map(({ _id }) => _id);
    const userResult = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { isDemo: true } },
    );
    const areaResult = await Area.updateMany(
      { gymId: gym._id, name: { $in: areaFixtures } },
      { $set: { isDemo: true } },
    );
    const exerciseResult = await Exercise.updateMany(
      { gymId: gym._id, name: { $in: exerciseFixtures.map(([name]) => name) } },
      { $set: { isDemo: true } },
    );
    const equipmentResult = await Equipment.updateMany(
      {
        gymId: gym._id,
        'beacon.uuid': gymBeaconUuid,
        'beacon.major': 1,
        'beacon.minor': { $in: equipmentFixtures.map((_, index) => index + 1) },
      },
      { $set: { isDemo: true } },
    );
    const clientSessionIds = Array.from({ length: 360 }, (_, index) =>
      beaconUuid(Math.floor(index / 12 + 1) * 100 + (index % 12) + 1),
    );
    const demoSessions = await UsageSession.find({
      userId: { $in: userIds },
      equipmentId: { $in: await Equipment.find({
        gymId: gym._id,
        'beacon.uuid': gymBeaconUuid,
        'beacon.major': 1,
      }).distinct('_id') },
      clientSessionId: { $in: clientSessionIds },
    }).select('_id');
    const sessionIds = demoSessions.map(({ _id }) => _id);
    const sessionResult = await UsageSession.updateMany(
      { _id: { $in: sessionIds } },
      { $set: { isDemo: true } },
    );
    const setResult = await SetLog.updateMany(
      { sessionId: { $in: sessionIds } },
      { $set: { isDemo: true } },
    );
    console.info(JSON.stringify({
      marked: {
        gyms: gymResult.modifiedCount,
        users: userResult.modifiedCount,
        areas: areaResult.modifiedCount,
        exercises: exerciseResult.modifiedCount,
        equipment: equipmentResult.modifiedCount,
        sessions: sessionResult.modifiedCount,
        sets: setResult.modifiedCount,
      },
    }));
  } finally {
    await mongoose.disconnect();
  }
}

markDemoData().catch((error) => {
  console.error(
    'Não foi possível marcar os dados de demonstração.',
    error instanceof Error ? error.name : 'UnknownError',
  );
  process.exitCode = 1;
});
