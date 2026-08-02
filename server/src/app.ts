import cookieParser from 'cookie-parser';
import express from 'express';
import type { DatabasePool } from './db/pool.js';
import type { ServerEnvironment } from './config/env.js';
import { errorHandler } from './lib/errors.js';
import { requireUser } from './middleware/require-user.js';
import { AuthRepository } from './modules/auth/auth.repository.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import type { EmailGateway } from './modules/email/email.gateway.js';
import { ListRepository } from './modules/lists/list.repository.js';
import { createListRouter } from './modules/lists/list.routes.js';

export function createApp(pool: DatabasePool, env: ServerEnvironment, email: EmailGateway) {
  const app = express();
  const authRepository = new AuthRepository(pool);
  const listRepository = new ListRepository(pool);

  app.use((request, response, next) => {
    const origin = request.header('origin');
    if (origin === env.APP_ORIGIN) response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, If-Match');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (request.method === 'OPTIONS') return response.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_request, response) => {
    await pool.query('SELECT 1');
    response.json({ status: 'ok' });
  });
  app.use('/api/auth', createAuthRouter({ repository: authRepository, env, email }));
  app.use('/api/lists', requireUser(authRepository, env), createListRouter(listRepository));
  app.use(errorHandler);

  return app;
}
