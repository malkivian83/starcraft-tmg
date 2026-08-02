import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { ArmyListPayload } from './list.schema.js';

export interface SavedListRecord {
  id: string;
  ownerId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  payload: ArmyListPayload;
}

interface SavedListRow extends RowDataPacket {
  id: string;
  owner_id: string;
  revision: number;
  created_at: string;
  updated_at: string;
  payload: ArmyListPayload | string;
}

function map(row: SavedListRow): SavedListRecord {
  return { id: row.id, ownerId: row.owner_id, revision: row.revision, createdAt: row.created_at, updatedAt: row.updated_at, payload: typeof row.payload === 'string' ? JSON.parse(row.payload) as ArmyListPayload : row.payload };
}

export class ListRepository {
  constructor(private readonly pool: Pool) {}

  async listForOwner(ownerId: string): Promise<SavedListRecord[]> {
    const [rows] = await this.pool.execute<SavedListRow[]>('SELECT id, owner_id, revision, created_at, updated_at, payload FROM saved_lists WHERE owner_id = ? ORDER BY updated_at DESC', [ownerId]);
    return rows.map(map);
  }

  async findForOwner(id: string, ownerId: string): Promise<SavedListRecord | null> {
    const [rows] = await this.pool.execute<SavedListRow[]>('SELECT id, owner_id, revision, created_at, updated_at, payload FROM saved_lists WHERE id = ? AND owner_id = ?', [id, ownerId]);
    return rows[0] ? map(rows[0]) : null;
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

  async delete(id: string, ownerId: string): Promise<boolean> {
    const [result] = await this.pool.execute('DELETE FROM saved_lists WHERE id = ? AND owner_id = ?', [id, ownerId]);
    return 'affectedRows' in result && result.affectedRows > 0;
  }
}
