import mysql, { type Pool } from 'mysql2/promise';

export type DatabasePool = Pool;

export function createPool(connectionString: string): DatabasePool {
  return mysql.createPool({ uri: connectionString, connectionLimit: 10, connectTimeout: 10_000, dateStrings: true });
}
