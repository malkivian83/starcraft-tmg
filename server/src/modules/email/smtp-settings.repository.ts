import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';

export interface SmtpSettings { host: string; port: number; secure: boolean; username: string; from: string; password?: string; passwordConfigured: boolean; }

export class SmtpSettingsRepository {
  private readonly key: Buffer;
  constructor(private readonly pool: Pool, secret: string) { this.key = createHash('sha256').update(secret).digest(); }
  private encrypt(value: string) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key, iv); const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return `${iv.toString('base64')}.${cipher.getAuthTag().toString('base64')}.${data.toString('base64')}`; }
  private decrypt(value: string) { const parts = value.split('.'); if (parts.length !== 3) throw new Error('Configuración SMTP cifrada inválida.'); const [iv, tag, data] = parts.map((part) => Buffer.from(part, 'base64')) as [Buffer, Buffer, Buffer]; const decipher = createDecipheriv('aes-256-gcm', this.key, iv); decipher.setAuthTag(tag); return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8'); }
  async get(includePassword = false): Promise<SmtpSettings | null> { const [rows] = await this.pool.execute<(RowDataPacket & { setting_value: string })[]>('SELECT setting_value FROM app_settings WHERE setting_key = ?', ['smtp']); if (!rows[0]) return null; const saved = JSON.parse(rows[0].setting_value) as Omit<SmtpSettings, 'passwordConfigured'> & { password: string }; return { ...saved, password: includePassword ? this.decrypt(saved.password) : undefined, passwordConfigured: Boolean(saved.password) }; }
  async save(input: Omit<SmtpSettings, 'passwordConfigured'>): Promise<void> { const current = await this.get(true); const password = input.password || current?.password || ''; const payload = JSON.stringify({ ...input, password: this.encrypt(password) }); await this.pool.execute('INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', ['smtp', payload]); }
}
