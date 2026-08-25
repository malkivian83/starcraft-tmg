import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { GameCommand, CreateGameInput, LinkListInput } from './game.schema.js';
import type { GameSession } from './game.types.js';
import { HttpError } from '../../lib/errors.js';
import { missionById } from './mission-catalog.js';

export interface GamePrincipal {
  type: 'ACCOUNT' | 'GUEST';
  accountId: string | null;
  guestId: string | null;
}

interface GameRow extends RowDataPacket {
  id: string;
  owner_type: 'ACCOUNT' | 'GUEST';
  owner_account_id: string | null;
  owner_guest_id: string | null;
  origin_type: 'ACCOUNT' | 'GUEST';
  status: GameSession['status'];
  points_limit: number;
  mission_id: string;
  mission_snapshot: string | GameSession['mission'];
  current_round: number;
  player1_name: string;
  player1_race: GameSession['players'][number]['race'];
  player1_vp: number;
  player2_name: string;
  player2_race: GameSession['players'][number]['race'];
  player2_vp: number;
  winner_slot: 1 | 2 | null;
  finish_reason: GameSession['finishReason'];
  owner_player_slot: 1 | 2 | null;
  linked_list_id: string | null;
  linked_match_record_id: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

const columns = `
  SELECT id, owner_type, owner_account_id, owner_guest_id, origin_type, status,
         points_limit, mission_id, mission_snapshot, current_round,
         player1_name, player1_race, player1_vp,
         player2_name, player2_race, player2_vp,
         winner_slot, finish_reason, owner_player_slot,
         linked_list_id, linked_match_record_id, revision,
         created_at, updated_at, finished_at
    FROM game_sessions`;

function ownerClause(principal: GamePrincipal): { sql: string; params: string[] } {
  return principal.type === 'ACCOUNT'
    ? { sql: 'owner_type = \'ACCOUNT\' AND owner_account_id = ?', params: [principal.accountId!] }
    : { sql: 'owner_type = \'GUEST\' AND owner_guest_id = ?', params: [principal.guestId!] };
}

function parseMission(value: string | GameSession['mission']): GameSession['mission'] {
  return typeof value === 'string' ? JSON.parse(value) as GameSession['mission'] : value;
}

function map(row: GameRow): GameSession {
  return {
    id: row.id,
    status: row.status,
    ownerType: row.owner_type,
    originType: row.origin_type,
    pointsLimit: Number(row.points_limit),
    mission: parseMission(row.mission_snapshot),
    currentRound: Number(row.current_round),
    players: [
      { name: row.player1_name, race: row.player1_race, victoryPoints: Number(row.player1_vp) },
      { name: row.player2_name, race: row.player2_race, victoryPoints: Number(row.player2_vp) },
    ],
    winnerPlayerSlot: row.winner_slot,
    finishReason: row.finish_reason,
    ownerPlayerSlot: row.owner_player_slot,
    linkedListId: row.linked_list_id,
    linkedMatchRecordId: row.linked_match_record_id,
    revision: Number(row.revision),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at,
  };
}

export class GameRepository {
  constructor(private readonly pool: Pool) {}

  async ensureGuest(token: string): Promise<string> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [rows] = await this.pool.execute<RowDataPacket[]>('SELECT id FROM game_guest_principals WHERE token_hash = ? AND revoked_at IS NULL', [tokenHash]);
    if (rows[0]?.id) {
      await this.pool.execute('UPDATE game_guest_principals SET last_activity = NOW() WHERE id = ?', [rows[0].id]);
      return String(rows[0].id);
    }
    const id = randomUUID();
    await this.pool.execute('INSERT IGNORE INTO game_guest_principals (id, token_hash) VALUES (?, ?)', [id, tokenHash]);
    const [created] = await this.pool.execute<RowDataPacket[]>('SELECT id FROM game_guest_principals WHERE token_hash = ? AND revoked_at IS NULL', [tokenHash]);
    if (!created[0]?.id) throw new HttpError(503, 'GUEST_IDENTITY_UNAVAILABLE', 'No se pudo crear la identidad invitada.');
    await this.pool.execute('UPDATE game_guest_principals SET last_activity = NOW() WHERE id = ?', [created[0].id]);
    return String(created[0].id);
  }

  async list(principal: GamePrincipal): Promise<GameSession[]> {
    const owner = ownerClause(principal);
    const [rows] = await this.pool.execute<GameRow[]>(`${columns} WHERE ${owner.sql} ORDER BY updated_at DESC`, owner.params);
    return rows.map(map);
  }

  async find(id: string, principal: GamePrincipal): Promise<GameSession | null> {
    const owner = ownerClause(principal);
    const [rows] = await this.pool.execute<GameRow[]>(`${columns} WHERE id = ? AND ${owner.sql}`, [id, ...owner.params]);
    return rows[0] ? map(rows[0]) : null;
  }

  async create(id: string, principal: GamePrincipal, input: CreateGameInput): Promise<GameSession> {
    const mission = missionById(input.missionId);
    await this.pool.execute(
      `INSERT INTO game_sessions
        (id, owner_type, owner_account_id, owner_guest_id, origin_type, status,
         points_limit, mission_id, mission_snapshot, current_round,
         player1_name, player1_race, player1_vp, player2_name, player2_race, player2_vp)
      VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, ?, 1, ?, ?, 0, ?, ?, 0)`,
      [
        id, principal.type, principal.type === 'ACCOUNT' ? principal.accountId : null, principal.type === 'GUEST' ? principal.guestId : null,
        principal.type, input.pointsLimit, mission.id, JSON.stringify(mission),
        input.players[0].name.trim(), input.players[0].race, input.players[1].name.trim(), input.players[1].race,
      ],
    );
    return (await this.find(id, principal))!;
  }

  async command(id: string, principal: GamePrincipal, expectedRevision: number, command: GameCommand): Promise<GameSession | null> {
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const current = await this.findOnConnection(connection, id, principal, true);
      if (!current) { await connection.rollback(); return null; }
      if (current.status !== 'ACTIVE') throw new HttpError(409, 'GAME_NOT_ACTIVE', 'La partida ya no está activa.');
      if (current.revision !== expectedRevision) throw new HttpError(409, 'GAME_CONFLICT', 'La partida fue modificada desde otra sesión.');

      const values: Array<string | number | null> = [];
      let set = '';
      switch (command.type) {
        case 'ADD_VP':
        case 'SUBTRACT_VP': {
          const column = command.slot === 1 ? 'player1_vp' : 'player2_vp';
          set = `${column} = GREATEST(0, ${column} + ?)`;
          values.push(command.type === 'ADD_VP' ? 1 : -1);
          break;
        }
        case 'ADVANCE_ROUND':
          if (current.currentRound >= current.mission.gameLength) throw new HttpError(409, 'FINAL_ROUND', 'La partida ya está en la ronda final.');
          set = 'current_round = current_round + 1';
          break;
        case 'UNDO_ROUND':
          if (current.currentRound <= 1) throw new HttpError(409, 'FIRST_ROUND', 'La partida ya está en la primera ronda.');
          set = 'current_round = current_round - 1';
          break;
        case 'FINALIZE':
          if (command.winnerPlayerSlot === null && command.finishReason !== 'DRAW') throw new HttpError(400, 'INVALID_RESULT', 'Un resultado sin ganador debe ser un empate.');
          if (command.winnerPlayerSlot !== null && command.finishReason === 'DRAW') throw new HttpError(400, 'INVALID_RESULT', 'Un empate no puede tener ganador.');
          set = 'status = \'FINISHED\', winner_slot = ?, finish_reason = ?, finished_at = NOW()';
          values.push(command.winnerPlayerSlot, command.finishReason);
          break;
        case 'ABANDON':
          set = 'status = \'ABANDONED\'';
          break;
      }
      const owner = ownerClause(principal);
      const [result] = await connection.execute<ResultSetHeader>(
        `UPDATE game_sessions SET ${set}, revision = revision + 1 WHERE id = ? AND ${owner.sql} AND revision = ?`,
        [...values, id, ...owner.params, expectedRevision],
      );
      if (!('affectedRows' in result) || result.affectedRows !== 1) throw new HttpError(409, 'GAME_CONFLICT', 'La partida fue modificada desde otra sesión.');
      await connection.commit();
      return this.find(id, principal);
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  async claim(id: string, guestId: string, accountId: string): Promise<GameSession | null> {
    const [result] = await this.pool.execute(
      `UPDATE game_sessions SET owner_type = 'ACCOUNT', owner_account_id = ?, owner_guest_id = NULL,
              revision = revision + 1 WHERE id = ? AND owner_type = 'GUEST' AND owner_guest_id = ?`,
      [accountId, id, guestId],
    );
    if (!('affectedRows' in result) || result.affectedRows !== 1) return null;
    return this.find(id, { type: 'ACCOUNT', accountId, guestId: null });
  }

  async linkList(id: string, principal: GamePrincipal, expectedRevision: number, input: LinkListInput): Promise<GameSession | null> {
    if (principal.type !== 'ACCOUNT' || !principal.accountId) throw new HttpError(403, 'FORBIDDEN', 'Inicia sesión para asociar una partida a una lista.');
    const connection = await this.pool.getConnection();
    try {
      await connection.beginTransaction();
      const owner = ownerClause(principal);
      const current = await this.findOnConnection(connection, id, principal, true);
      if (!current) { await connection.rollback(); return null; }
      if (current.status !== 'FINISHED') throw new HttpError(409, 'GAME_NOT_FINISHED', 'Solo se pueden asociar partidas finalizadas.');
      if (current.revision !== expectedRevision) throw new HttpError(409, 'GAME_CONFLICT', 'La partida fue modificada desde otra sesión.');
      if (current.linkedMatchRecordId) { await connection.commit(); return current; }
      const [lists] = await connection.execute<RowDataPacket[]>('SELECT id, race FROM saved_lists WHERE id = ? AND owner_id = ?', [input.listId, principal.accountId]);
      const list = lists[0];
      if (!list) throw new HttpError(404, 'LIST_NOT_FOUND', 'No existe esa lista.');
      const ownerPlayer = current.players[input.ownerPlayerSlot - 1]!;
      if (list.race !== ownerPlayer.race) throw new HttpError(400, 'LIST_RACE_MISMATCH', 'La raza de la lista no coincide con el jugador elegido.');
      const winner = current.winnerPlayerSlot;
      const result = winner === null ? 'DRAW' : winner === input.ownerPlayerSlot ? 'WIN' : 'LOSS';
      const opponent = current.players[input.ownerPlayerSlot === 1 ? 1 : 0];
      const matchId = randomUUID();
      await connection.execute(
        `INSERT INTO list_match_records
          (id, list_id, owner_id, result, played_on, opponent_race, opponent_faction_card_id, opponent_name)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`,
        [matchId, input.listId, principal.accountId, result, current.finishedAt?.slice(0, 10) ?? null, opponent.race, opponent.name],
      );
      const [updated] = await connection.execute(
        `UPDATE game_sessions SET owner_player_slot = ?, linked_list_id = ?, linked_match_record_id = ?, revision = revision + 1
          WHERE id = ? AND ${owner.sql} AND revision = ?`,
        [input.ownerPlayerSlot, input.listId, matchId, id, ...owner.params, current.revision],
      );
      if (!('affectedRows' in updated) || updated.affectedRows !== 1) throw new HttpError(409, 'GAME_CONFLICT', 'La partida fue modificada desde otra sesión.');
      await connection.commit();
      return this.find(id, principal);
    } catch (error) {
      await connection.rollback().catch(() => undefined);
      throw error;
    } finally {
      connection.release();
    }
  }

  async delete(id: string, principal: GamePrincipal): Promise<boolean> {
    const owner = ownerClause(principal);
    const [result] = await this.pool.execute(`DELETE FROM game_sessions WHERE id = ? AND ${owner.sql}`, [id, ...owner.params]);
    return 'affectedRows' in result && result.affectedRows === 1;
  }

  private async findOnConnection(connection: PoolConnection, id: string, principal: GamePrincipal, lock: boolean): Promise<GameSession | null> {
    const owner = ownerClause(principal);
    const [rows] = await connection.execute<GameRow[]>(`${columns} WHERE id = ? AND ${owner.sql}${lock ? ' FOR UPDATE' : ''}`, [id, ...owner.params]);
    return rows[0] ? map(rows[0]) : null;
  }
}
