import { randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';

export type Race = 'ZERG' | 'TERRAN' | 'PROTOSS';
export type AuthProvider = 'PASSWORD' | 'GOOGLE' | 'BOTH';

/** Cómo puede entrar la cuenta hoy, no cómo se creó: al añadir contraseña o vincular Google, cambia. */
export function authProviderOf(user: { passwordHash: string | null; googleSub: string | null }): AuthProvider {
  if (user.googleSub && user.passwordHash) return 'BOTH';
  return user.googleSub ? 'GOOGLE' : 'PASSWORD';
}

export interface UserRecord {
  id: string;
  email: string;
  // Nulo mientras la cuenta sólo tenga acceso con Google.
  passwordHash: string | null;
  googleSub: string | null;
  emailVerifiedAt: string | null;
  deletedAt: string | null;
  sessionVersion: number;
  defaultRace: Race;
  nickname: string | null;
  avatar: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
}

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  password_hash: string | null;
  google_sub: string | null;
  email_verified_at: string | null;
  deleted_at: string | null;
  session_version: number;
  default_race: Race;
  nickname: string | null;
  avatar: string | null;
  is_active: number;
  last_login_at: string | null;
}

function mapUser(row: UserRow): UserRecord {
  return { id: row.id, email: row.email, passwordHash: row.password_hash, googleSub: row.google_sub, emailVerifiedAt: row.email_verified_at, deletedAt: row.deleted_at, sessionVersion: row.session_version, defaultRace: row.default_race, nickname: row.nickname, avatar: row.avatar, isActive: Boolean(row.is_active), lastLoginAt: row.last_login_at };
}

const userColumns = `SELECT u.id, u.email, u.password_hash, u.google_sub, u.email_verified_at, u.deleted_at, u.is_active, u.session_version, u.last_login_at, p.default_race, p.nickname, p.avatar FROM users u JOIN profiles p ON p.user_id = u.id`;

export class AuthRepository {
  constructor(private readonly pool: Pool) {}

  async findByEmail(emailNormalized: string): Promise<UserRecord | null> {
    const [rows] = await this.pool.execute<UserRow[]>(`${userColumns} WHERE u.email_normalized = ?`, [emailNormalized]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [rows] = await this.pool.execute<UserRow[]>(`${userColumns} WHERE u.id = ?`, [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  async createUser(email: string, emailNormalized: string, passwordHash: string): Promise<UserRecord> {
    return this.transaction(async (connection) => {
      const id = randomUUID();
      await connection.execute('INSERT INTO users (id, email, email_normalized, password_hash) VALUES (?, ?, ?, ?)', [id, email, emailNormalized, passwordHash]);
      await connection.execute('INSERT INTO profiles (user_id) VALUES (?)', [id]);
      const [rows] = await connection.execute<UserRow[]>(`${userColumns} WHERE u.id = ?`, [id]);
      return mapUser(rows[0]!);
    });
  }

  async findByGoogleSub(googleSub: string): Promise<UserRecord | null> {
    const [rows] = await this.pool.execute<UserRow[]>(`${userColumns} WHERE u.google_sub = ?`, [googleSub]);
    return rows[0] ? mapUser(rows[0]) : null;
  }

  /** Alta de una cuenta cuya identidad la respalda Google: sin contraseña y ya verificada. */
  async createGoogleUser(email: string, emailNormalized: string, googleSub: string, nickname: string | null): Promise<UserRecord> {
    return this.transaction(async (connection) => {
      const id = randomUUID();
      await connection.execute('INSERT INTO users (id, email, email_normalized, password_hash, google_sub, email_verified_at) VALUES (?, ?, ?, NULL, ?, NOW())', [id, email, emailNormalized, googleSub]);
      await connection.execute('INSERT INTO profiles (user_id, nickname) VALUES (?, ?)', [id, nickname]);
      const [rows] = await connection.execute<UserRow[]>(`${userColumns} WHERE u.id = ?`, [id]);
      return mapUser(rows[0]!);
    });
  }

  /**
   * Vincula Google a una cuenta previa. Google ya comprobó el correo, así que
   * la verificación pendiente se da por buena en ese momento.
   */
  async linkGoogleAccount(userId: string, googleSub: string): Promise<UserRecord> {
    await this.pool.execute('UPDATE users SET google_sub = ?, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?', [googleSub, userId]);
    return (await this.findById(userId))!;
  }

  async createToken(userId: string, tokenHash: string, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD'): Promise<void> {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await this.pool.execute('INSERT INTO account_tokens (id, user_id, token_hash, purpose, expires_at) VALUES (?, ?, ?, ?, ?)', [randomUUID(), userId, tokenHash, purpose, expiresAt]);
  }

  async consumeToken(tokenHash: string, purpose: 'VERIFY_EMAIL' | 'RESET_PASSWORD'): Promise<UserRecord | null> {
    return this.transaction(async (connection) => {
      const [rows] = await connection.execute<(RowDataPacket & { user_id: string })[]>('SELECT user_id FROM account_tokens WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > NOW() FOR UPDATE', [tokenHash, purpose]);
      const token = rows[0];
      if (!token) return null;
      await connection.execute('UPDATE account_tokens SET used_at = NOW() WHERE token_hash = ?', [tokenHash]);
      const [users] = await connection.execute<UserRow[]>(`${userColumns} WHERE u.id = ?`, [token.user_id]);
      return users[0] ? mapUser(users[0]) : null;
    });
  }

  async verifyEmail(userId: string): Promise<void> { await this.pool.execute('UPDATE users SET email_verified_at = NOW() WHERE id = ?', [userId]); }
  async setEmailVerified(userId: string, isVerified: boolean): Promise<void> { await this.pool.execute('UPDATE users SET email_verified_at = ? WHERE id = ?', [isVerified ? new Date() : null, userId]); }

  async updatePassword(userId: string, passwordHash: string): Promise<UserRecord> {
    await this.pool.execute('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?', [passwordHash, userId]);
    return (await this.findById(userId))!;
  }

  async recordLogin(userId: string): Promise<void> { await this.pool.execute('UPDATE users SET last_login_at = NOW() WHERE id = ?', [userId]); }
  async setUserActive(userId: string, isActive: boolean): Promise<void> { await this.pool.execute('UPDATE users SET is_active = ?, session_version = session_version + 1 WHERE id = ?', [isActive, userId]); }

  async listUsersForAdmin(): Promise<Array<{ id: string; email: string; nickname: string | null; isActive: boolean; emailVerifiedAt: string | null; authProvider: AuthProvider; lastLoginAt: string | null; savedLists: number }>> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(`SELECT u.id, u.email, p.nickname, u.is_active, u.email_verified_at, u.google_sub, u.password_hash IS NOT NULL AS has_password, u.last_login_at, COUNT(l.id) AS saved_lists FROM users u JOIN profiles p ON p.user_id = u.id LEFT JOIN saved_lists l ON l.owner_id = u.id GROUP BY u.id, u.email, p.nickname, u.is_active, u.email_verified_at, u.google_sub, has_password, u.last_login_at ORDER BY u.created_at DESC`);
    return rows.map((row) => ({ id: row.id, email: row.email, nickname: row.nickname, isActive: Boolean(row.is_active), emailVerifiedAt: row.email_verified_at, authProvider: authProviderOf({ googleSub: row.google_sub, passwordHash: Number(row.has_password) ? 'set' : null }), lastLoginAt: row.last_login_at, savedLists: Number(row.saved_lists) }));
  }

  async updateDefaultRace(userId: string, defaultRace: Race): Promise<UserRecord> {
    await this.pool.execute('UPDATE profiles SET default_race = ? WHERE user_id = ?', [defaultRace, userId]);
    return (await this.findById(userId))!;
  }

  async updateProfile(userId: string, profile: { defaultRace: Race; nickname: string | null; avatar: string | null }): Promise<UserRecord> {
    await this.pool.execute(
      'UPDATE profiles SET default_race = ?, nickname = ?, avatar = ? WHERE user_id = ?',
      [profile.defaultRace, profile.nickname, profile.avatar, userId],
    );
    return (await this.findById(userId))!;
  }

  async softDeleteUser(userId: string): Promise<void> { await this.pool.execute('UPDATE users SET deleted_at = NOW(), session_version = session_version + 1 WHERE id = ? AND deleted_at IS NULL', [userId]); }

  private async transaction<T>(operation: (connection: PoolConnection) => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    try { await connection.beginTransaction(); const result = await operation(connection); await connection.commit(); return result; }
    catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
  }
}
