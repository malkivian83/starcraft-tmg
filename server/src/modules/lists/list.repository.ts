import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { ArmyListPayload } from './list.schema.js';

export interface SavedListRecord {
  id: string;
  ownerId: string;
  ownerNickname: string | null;
  isPublic: boolean;
  publishedAt: string | null;
  revision: number;
  createdAt: string;
  updatedAt: string;
  payload: ArmyListPayload;
  likeCount: number;
  likedByCurrentUser: boolean;
}

interface SavedListRow extends RowDataPacket {
  id: string;
  owner_id: string;
  owner_nickname: string | null;
  is_public: number | boolean;
  published_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
  payload: ArmyListPayload | string;
}

interface LikeSummaryRow extends RowDataPacket {
  list_id: string;
  like_count: number | string;
  liked_by_current_user: number | string;
}

const recordColumns = `
  SELECT l.id, l.owner_id, p.nickname AS owner_nickname, l.is_public, l.published_at,
         l.revision, l.created_at, l.updated_at, l.payload
    FROM saved_lists l
    JOIN profiles p ON p.user_id = l.owner_id
`;

function map(row: SavedListRow): SavedListRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    ownerNickname: row.owner_nickname,
    isPublic: Boolean(row.is_public),
    publishedAt: row.published_at,
    revision: row.revision,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) as ArmyListPayload : row.payload,
    likeCount: 0,
    likedByCurrentUser: false,
  };
}

function limitValue(limit: number): number {
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

export class ListRepository {
  constructor(private readonly pool: Pool) {}

  async listForOwner(ownerId: string): Promise<SavedListRecord[]> {
    const [rows] = await this.pool.execute<SavedListRow[]>(`${recordColumns} WHERE l.owner_id = ? ORDER BY l.updated_at DESC`, [ownerId]);
    return this.withLikeMetadata(rows.map(map), ownerId);
  }

  async listLatestForOwner(ownerId: string, limit = 5): Promise<SavedListRecord[]> {
    const [rows] = await this.pool.execute<SavedListRow[]>(`${recordColumns} WHERE l.owner_id = ? ORDER BY l.updated_at DESC LIMIT ${limitValue(limit)}`, [ownerId]);
    return this.withLikeMetadata(rows.map(map), ownerId);
  }

  async listLatestPublic(viewerId: string, limit = 10): Promise<SavedListRecord[]> {
    const [rows] = await this.pool.execute<SavedListRow[]>(`${recordColumns}
    JOIN users u ON u.id = l.owner_id
   WHERE l.is_public = 1
     AND u.is_active = 1
     AND u.deleted_at IS NULL
     AND u.email_verified_at IS NOT NULL
   ORDER BY l.published_at DESC, l.updated_at DESC
   LIMIT ${limitValue(limit)}`);
    return this.withLikeMetadata(rows.map(map), viewerId);
  }

  async listPublic(viewerId: string): Promise<SavedListRecord[]> {
    const [rows] = await this.pool.execute<SavedListRow[]>(`${recordColumns}
    JOIN users u ON u.id = l.owner_id
   WHERE l.is_public = 1
     AND u.is_active = 1
     AND u.deleted_at IS NULL
     AND u.email_verified_at IS NOT NULL
   ORDER BY l.published_at DESC, l.updated_at DESC`);
    return this.withLikeMetadata(rows.map(map), viewerId);
  }

  async findForOwner(id: string, ownerId: string): Promise<SavedListRecord | null> {
    const [rows] = await this.pool.execute<SavedListRow[]>(`${recordColumns} WHERE l.id = ? AND l.owner_id = ?`, [id, ownerId]);
    if (!rows[0]) return null;
    return (await this.withLikeMetadata([map(rows[0])], ownerId))[0] ?? null;
  }

  async findPublic(id: string, viewerId: string): Promise<SavedListRecord | null> {
    const [rows] = await this.pool.execute<SavedListRow[]>(`${recordColumns}
    JOIN users u ON u.id = l.owner_id
   WHERE l.id = ?
     AND l.is_public = 1
     AND u.is_active = 1
     AND u.deleted_at IS NULL
     AND u.email_verified_at IS NOT NULL`, [id]);
    if (!rows[0]) return null;
    return (await this.withLikeMetadata([map(rows[0])], viewerId))[0] ?? null;
  }

  async like(id: string, userId: string): Promise<void> {
    await this.pool.execute('INSERT IGNORE INTO saved_list_likes (list_id, user_id) VALUES (?, ?)', [id, userId]);
  }

  async unlike(id: string, userId: string): Promise<void> {
    await this.pool.execute('DELETE FROM saved_list_likes WHERE list_id = ? AND user_id = ?', [id, userId]);
  }

  async create(ownerId: string, payload: ArmyListPayload): Promise<SavedListRecord> {
    await this.pool.execute('INSERT INTO saved_lists (id, owner_id, name, race, payload, catalog_content_version, schema_version) VALUES (?, ?, ?, ?, ?, ?, ?)', [payload.id, ownerId, payload.name, payload.race, JSON.stringify(payload), payload.catalogContentVersion, payload.schemaVersion]);
    return (await this.findForOwner(payload.id, ownerId))!;
  }

  async update(id: string, ownerId: string, expectedRevision: number, payload: ArmyListPayload): Promise<SavedListRecord | null> {
    const [result] = await this.pool.execute('UPDATE saved_lists SET name = ?, race = ?, payload = ?, catalog_content_version = ?, schema_version = ?, revision = revision + 1 WHERE id = ? AND owner_id = ? AND revision = ?', [payload.name, payload.race, JSON.stringify(payload), payload.catalogContentVersion, payload.schemaVersion, id, ownerId, expectedRevision]);
    if (!('affectedRows' in result) || result.affectedRows === 0) return null;
    return this.findForOwner(id, ownerId);
  }

  async setPublic(id: string, ownerId: string, isPublic: boolean): Promise<SavedListRecord | null> {
    const query = isPublic
      ? 'UPDATE saved_lists SET is_public = 1, published_at = NOW() WHERE id = ? AND owner_id = ?'
      : 'UPDATE saved_lists SET is_public = 0, published_at = NULL WHERE id = ? AND owner_id = ?';
    const [result] = await this.pool.execute(query, [id, ownerId]);
    if (!('affectedRows' in result) || result.affectedRows === 0) return null;
    return this.findForOwner(id, ownerId);
  }

  async delete(id: string, ownerId: string): Promise<boolean> {
    const [result] = await this.pool.execute('DELETE FROM saved_lists WHERE id = ? AND owner_id = ?', [id, ownerId]);
    return 'affectedRows' in result && result.affectedRows > 0;
  }

  private async withLikeMetadata(records: SavedListRecord[], viewerId: string): Promise<SavedListRecord[]> {
    if (records.length === 0) return records;
    const ids = records.map((record) => record.id);
    const placeholders = ids.map(() => '?').join(', ');
    const [rows] = await this.pool.execute<LikeSummaryRow[]>(
      `SELECT list_id, COUNT(*) AS like_count,
              SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS liked_by_current_user
         FROM saved_list_likes
        WHERE list_id IN (${placeholders})
        GROUP BY list_id`,
      [viewerId, ...ids],
    );
    const metadata = new Map(rows.map((row) => [row.list_id, {
      likeCount: Number(row.like_count),
      likedByCurrentUser: Number(row.liked_by_current_user) > 0,
    }]));
    return records.map((record) => ({ ...record, ...(metadata.get(record.id) ?? { likeCount: 0, likedByCurrentUser: false }) }));
  }
}
