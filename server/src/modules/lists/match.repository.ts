import { randomUUID } from 'node:crypto';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { MatchRecordInput } from './match.schema.js';

export interface MatchRecord {
  id: string;
  listId: string;
  result: 'WIN' | 'LOSS' | 'DRAW';
  playedOn: string | null;
  opponentRace: 'ZERG' | 'TERRAN' | 'PROTOSS' | null;
  opponentFactionCardId: string | null;
  opponentName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchSummary {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

interface MatchRow extends RowDataPacket {
  id: string;
  list_id: string;
  result: MatchRecord['result'];
  played_on: string | null;
  opponent_race: MatchRecord['opponentRace'];
  opponent_faction_card_id: string | null;
  opponent_name: string | null;
  created_at: string;
  updated_at: string;
}

interface MatchSummaryRow extends RowDataPacket {
  played: number | string | null;
  wins: number | string | null;
  losses: number | string | null;
  draws: number | string | null;
}

function map(row: MatchRow): MatchRecord {
  return {
    id: row.id,
    listId: row.list_id,
    result: row.result,
    playedOn: row.played_on,
    opponentRace: row.opponent_race,
    opponentFactionCardId: row.opponent_faction_card_id,
    opponentName: row.opponent_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function summary(row: MatchSummaryRow | undefined): MatchSummary {
  return {
    played: Number(row?.played ?? 0),
    wins: Number(row?.wins ?? 0),
    losses: Number(row?.losses ?? 0),
    draws: Number(row?.draws ?? 0),
  };
}

export class MatchRepository {
  constructor(private readonly pool: Pool) {}

  async listForList(listId: string, ownerId: string): Promise<MatchRecord[]> {
    const [rows] = await this.pool.execute<MatchRow[]>(
      `SELECT id, list_id, result, played_on, opponent_race, opponent_faction_card_id,
              opponent_name, created_at, updated_at
         FROM list_match_records
        WHERE list_id = ? AND owner_id = ?
        ORDER BY played_on IS NULL, played_on DESC, created_at DESC`,
      [listId, ownerId],
    );
    return rows.map(map);
  }

  async countForList(listId: string, ownerId: string): Promise<number> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) AS count FROM list_match_records WHERE list_id = ? AND owner_id = ?',
      [listId, ownerId],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async summaryForList(listId: string, ownerId: string): Promise<MatchSummary> {
    const [rows] = await this.pool.execute<MatchSummaryRow[]>(
      `SELECT COUNT(*) AS played,
              SUM(result = 'WIN') AS wins,
              SUM(result = 'LOSS') AS losses,
              SUM(result = 'DRAW') AS draws
         FROM list_match_records
        WHERE list_id = ? AND owner_id = ?`,
      [listId, ownerId],
    );
    return summary(rows[0]);
  }

  async create(listId: string, ownerId: string, input: MatchRecordInput): Promise<MatchRecord> {
    const id = randomUUID();
    await this.pool.execute(
      `INSERT INTO list_match_records
        (id, list_id, owner_id, result, played_on, opponent_race,
         opponent_faction_card_id, opponent_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, listId, ownerId, input.result, input.playedOn, input.opponentRace,
        input.opponentFactionCardId, input.opponentName],
    );
    return (await this.findOne(id, listId, ownerId))!;
  }

  async update(id: string, listId: string, ownerId: string, input: MatchRecordInput): Promise<MatchRecord | null> {
    const [result] = await this.pool.execute(
      `UPDATE list_match_records
          SET result = ?, played_on = ?, opponent_race = ?,
              opponent_faction_card_id = ?, opponent_name = ?
        WHERE id = ? AND list_id = ? AND owner_id = ?`,
      [input.result, input.playedOn, input.opponentRace, input.opponentFactionCardId,
        input.opponentName, id, listId, ownerId],
    );
    if (!('affectedRows' in result) || result.affectedRows === 0) return null;
    return this.findOne(id, listId, ownerId);
  }

  async delete(id: string, listId: string, ownerId: string): Promise<boolean> {
    const [result] = await this.pool.execute(
      'DELETE FROM list_match_records WHERE id = ? AND list_id = ? AND owner_id = ?',
      [id, listId, ownerId],
    );
    return 'affectedRows' in result && result.affectedRows > 0;
  }

  async findOne(id: string, listId: string, ownerId: string): Promise<MatchRecord | null> {
    const [rows] = await this.pool.execute<MatchRow[]>(
      `SELECT id, list_id, result, played_on, opponent_race, opponent_faction_card_id,
              opponent_name, created_at, updated_at
         FROM list_match_records
        WHERE id = ? AND list_id = ? AND owner_id = ?`,
      [id, listId, ownerId],
    );
    return rows[0] ? map(rows[0]) : null;
  }
}
