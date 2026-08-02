import { createApp } from './app.js';
import { readEnvironment } from './config/env.js';
import { createPool } from './db/pool.js';
import { DevelopmentEmailGateway } from './modules/email/email.gateway.js';

const env = readEnvironment();
const pool = createPool(env.DATABASE_URL);
const app = createApp(pool, env, new DevelopmentEmailGateway(env));

const server = app.listen(env.PORT, () => {
  console.info(`API disponible en http://localhost:${env.PORT}/api`);
});

async function shutdown(): Promise<void> {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
