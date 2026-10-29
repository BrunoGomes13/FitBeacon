import './dns-dev.js';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { getConfig } from './config.js';
import { logger } from './logger.js';
import { initializeModels } from './models/index.js';

async function startServer() {
  const config = getConfig();
  await mongoose.connect(config.MONGODB_URI);
  await initializeModels();
  const app = createApp(config);
  const server = app.listen(config.PORT, () => {
    logger.info({ port: config.PORT }, 'FitBeacon API iniciada');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Encerrando a API');
    server.close((error) => {
      if (error) {
        logger.error({ error: error.name }, 'Falha ao encerrar o servidor HTTP');
        process.exitCode = 1;
      }

      void mongoose.disconnect();
    });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error: unknown) => {
  logger.error(
    { error: error instanceof Error ? error.name : 'UnknownError' },
    'Não foi possível iniciar a API. Verifique a configuração e a conexão com o MongoDB.',
  );
  process.exitCode = 1;
});
