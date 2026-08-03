import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RowDataPacket } from 'mysql2';
import { readEnvironment } from '../config/env.js';
import { createPool } from './pool.js';

const env = readEnvironment();
const pool = createPool(env.DATABASE_URL);
const migrationDirectory = resolve(process.cwd(), 'server/src/db/migrations');

try {
  // MariaDB asocia GET_LOCK a una conexión: se conserva el mismo cliente
  // desde su adquisición hasta la liberación del bloqueo.
  const client = await pool.getConnection();
  let lockAcquired = false;
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(255) PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const [lock] = await client.query<RowDataPacket[]>("SELECT GET_LOCK('starcraft_tmg_migrations', 30) AS acquired");
    if (Number(lock[0]?.acquired) !== 1) throw new Error('No se pudo obtener el bloqueo de migraciones.');
    lockAcquired = true;

    const migrations = (await readdir(migrationDirectory))
      .filter((name) => name.endsWith('.sql'))
      .sort();

    for (const name of migrations) {
      const [applied] = await client.query<RowDataPacket[]>('SELECT 1 FROM schema_migrations WHERE name = ?', [name]);
      if (applied.length > 0) continue;
      const sql = await readFile(resolve(migrationDirectory, name), 'utf8');

      // El DDL confirma implícitamente en MariaDB: en vez de prometer una
      // transacción imposible, las migraciones son idempotentes y reintentables.
      // Solo se registran cuando todas las sentencias han terminado.
      for (const statement of sql.split(/;\s*(?:\r?\n|$)/)) {
        if (statement.trim()) await client.query(statement);
      }
      await client.query('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
      console.info(`Migración aplicada: ${name}`);
    }
  } finally {
    if (lockAcquired) await client.query("SELECT RELEASE_LOCK('starcraft_tmg_migrations')").catch(() => undefined);
    client.release();
  }
} finally {
  await pool.end();
}
