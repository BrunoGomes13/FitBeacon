import mongoose from 'mongoose';
import { getConfig } from '../src/config.ts';
import { SetLog, UsageSession, initializeModels } from '../src/models/index.ts';

async function purgeDemoData() {
  const confirmed = process.argv.includes('--confirm');
  const config = getConfig();
  await mongoose.connect(config.MONGODB_URI);
  try {
    await initializeModels();
    const sessions = await UsageSession.find({ isDemo: true }).select('_id').lean();
    const sessionIds = sessions.map(({ _id }) => _id);
    const [setCount, sessionCount] = await Promise.all([
      SetLog.countDocuments({ isDemo: true, sessionId: { $in: sessionIds } }),
      UsageSession.countDocuments({ isDemo: true, _id: { $in: sessionIds } }),
    ]);
    console.info(JSON.stringify({
      mode: confirmed ? 'confirmado' : 'simulação',
      documentsToDelete: { sessions: sessionCount, sets: setCount },
      usersAndCatalog: 'preservados',
    }));

    if (!confirmed) {
      console.info('Simulação apenas. Para apagar essas sessões e séries, execute novamente com --confirm.');
      return;
    }

    const sets = await SetLog.deleteMany({
      isDemo: true,
      sessionId: { $in: sessionIds },
    });
    const deletedSessions = await UsageSession.deleteMany({
      isDemo: true,
      _id: { $in: sessionIds },
    });
    console.info(JSON.stringify({
      deleted: { sessions: deletedSessions.deletedCount, sets: sets.deletedCount },
      usersAndCatalog: 'preservados',
    }));
  } finally {
    await mongoose.disconnect();
  }
}

purgeDemoData().catch((error) => {
  console.error(
    'Não foi possível purgar os dados de demonstração.',
    error instanceof Error ? error.name : 'UnknownError',
  );
  process.exitCode = 1;
});
