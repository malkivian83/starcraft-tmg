import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readEnvironment } from '../config/env.js';
import { createPool } from './pool.js';

const env = readEnvironment();
const pool = createPool(env.DATABASE_URL);
const migrationDirectory = resolve(process.cwd(), 'server/src/db/migrations');

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name VARCHAR(255) PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query("SELECT GET_LOCK('starcraft_tmg_migrations', 30)");

  const migrations = (await readdir(migrationDirectory))
    .filter((name) => name.endsWith('.sql'))
    .sort();

  for (const name of migrations) {
    const [applied] = await pool.query('SELECT 1 FROM schema_migrations WHERE name = ?', [name]);
    if (Array.isArray(applied) && applied.length > 0) continue;
    const sql = await readFile(resolve(migrationDirectory, name), 'utf8');
    const client = await pool.getConnection();
    try {
      await client.beginTransaction();
      for (const statement of sql.split(/;\s*(?:\r?\n|$)/)) {
        if (statement.trim()) await client.query(statement);
      }
      await client.query('INSERT INTO schema_migrations (name) VALUES (?)', [name]);
      await client.commit();
      console.info(`Migración aplicada: ${name}`);
    } catch (error) {
      await client.rollback();
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.query("SELECT RELEASE_LOCK('starcraft_tmg_migrations')").catch(() => undefined);
  await pool.end();
}
