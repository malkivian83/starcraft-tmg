import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/src/app';
import type { ServerEnvironment } from '../../server/src/config/env';
import type { DatabasePool } from '../../server/src/db/pool';
import type { EmailGateway } from '../../server/src/modules/email/email.gateway';

const databaseQuery = vi.fn(async () => {
  throw new Error('Una peticion sin autenticar no debe consultar la base de datos.');
});
const databaseExecute = vi.fn(async () => {
  throw new Error('Una peticion sin autenticar no debe consultar la base de datos.');
});

const pool = {
  query: databaseQuery,
  execute: databaseExecute,
} as unknown as DatabasePool;

const environment: ServerEnvironment = {
  PORT: 3001,
  APP_ORIGIN: 'http://localhost:5173',
  APP_BASE_URL: 'http://localhost:5173',
  DATABASE_URL: 'mysql://unused',
  SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
  NODE_ENV: 'test',
};

const email: EmailGateway = {
  sendVerificationEmail: vi.fn(async () => undefined),
  sendPasswordResetEmail: vi.fn(async () => undefined),
  sendAccountVerifiedEmail: vi.fn(async () => undefined),
};

describe('autorizacion HTTP de listas', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = createApp(pool, environment, email);
    server = await new Promise<Server>((resolve, reject) => {
      const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
      listeningServer.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  });

  it.each([
    ['GET', '/api/lists'],
    ['POST', '/api/lists'],
    ['PUT', '/api/lists/00000000-0000-4000-8000-000000000001'],
    ['DELETE', '/api/lists/00000000-0000-4000-8000-000000000001'],
  ])('rechaza %s %s sin cookie antes de consultar la BD', async (method, path) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: method === 'POST' || method === 'PUT'
        ? { 'Content-Type': 'application/json' }
        : undefined,
      body: method === 'POST' || method === 'PUT' ? '{}' : undefined,
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'UNAUTHENTICATED' },
    });
    expect(databaseQuery).not.toHaveBeenCalled();
    expect(databaseExecute).not.toHaveBeenCalled();
  });
});
