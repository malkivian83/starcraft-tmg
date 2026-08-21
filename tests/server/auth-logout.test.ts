import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../server/src/app';
import type { ServerEnvironment } from '../../server/src/config/env';
import type { DatabasePool } from '../../server/src/db/pool';
import type { EmailGateway } from '../../server/src/modules/email/email.gateway';

const environment: ServerEnvironment = {
  PORT: 3001,
  APP_ORIGIN: 'http://localhost:5173',
  APP_BASE_URL: 'http://localhost:5173',
  DATABASE_URL: 'mysql://unused',
  SESSION_SECRET: 'test-session-secret-with-at-least-32-characters',
  NODE_ENV: 'test',
};

const pool = {
  query: vi.fn(),
  execute: vi.fn(),
} as unknown as DatabasePool;

const email: EmailGateway = {
  sendVerificationEmail: vi.fn(async () => undefined),
  sendPasswordResetEmail: vi.fn(async () => undefined),
  sendAccountVerifiedEmail: vi.fn(async () => undefined),
};

describe('cierre de sesión HTTP', () => {
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
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  });

  it('desactiva la caché y limpia cookies con ambos ámbitos de ruta', async () => {
    const response = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    const cookies = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(204);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(cookies).toContain('Path=/api');
    expect(cookies).toContain('Path=/');
  });
});
