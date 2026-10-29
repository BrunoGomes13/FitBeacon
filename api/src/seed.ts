import './dns-dev.js';
import mongoose from 'mongoose';
import { getConfig } from './config.js';
import { initializeModels } from './models/index.js';
import { seedData } from './seed-data.js';

async function runSeed() {
  const config = getConfig();
  await mongoose.connect(config.MONGODB_URI);
  await initializeModels();

  try {
    const result = await seedData(config);
    console.info(
      `Seed concluído: academia ${result.gymId}, 4 áreas, 12 equipamentos, 20 exercícios e ${result.sessions} sessões.`,
    );
  } finally {
    await mongoose.disconnect();
  }
}

runSeed().catch((error: unknown) => {
  console.error(
    'Não foi possível gerar o seed. Verifique a configuração e a conexão com o MongoDB.',
    error instanceof Error ? error.name : 'UnknownError',
  );
  process.exitCode = 1;
});
