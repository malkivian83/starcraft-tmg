import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';
import { GameRepository } from '../../server/src/modules/game-sessions/game.repository';

describe('resumen administrativo de partidas', () => {
  it('agrupa todas las sesiones por usuario, incluidos los estados en curso', async () => {
    const rows = [
      {
        owner_type: 'ACCOUNT', user_id: 'user-1', email: 'one@example.com', nickname: 'One', is_active: 1,
        sessions: '3', configuration: '0', active: '1', finished: '2', abandoned: '0',
        last_activity_at: '2026-08-30 12:00:00',
      },
      {
        owner_type: 'ACCOUNT', user_id: 'user-2', email: 'two@example.com', nickname: null, is_active: 0,
        sessions: 1, configuration: 1, active: 0, finished: 0, abandoned: 0,
        last_activity_at: '2026-08-29 10:00:00',
      },
      {
        owner_type: 'GUEST', user_id: null, email: null, nickname: null, is_active: null,
        sessions: 2, configuration: 0, active: 1, finished: 0, abandoned: 1,
        last_activity_at: '2026-08-28 10:00:00',
      },
    ];
    const execute = vi.fn(async () => [rows, []]);
    const repository = new GameRepository({ execute } as unknown as Pool);

    await expect(repository.adminSummaryByUser()).resolves.toEqual({
      users: [
        {
          userId: 'user-1', email: 'one@example.com', nickname: 'One', isActive: true,
          sessions: 3, configuration: 0, active: 1, finished: 2, abandoned: 0,
          lastActivityAt: '2026-08-30 12:00:00',
        },
        {
          userId: 'user-2', email: 'two@example.com', nickname: null, isActive: false,
          sessions: 1, configuration: 1, active: 0, finished: 0, abandoned: 0,
          lastActivityAt: '2026-08-29 10:00:00',
        },
      ],
      totals: { users: 2, sessions: 6, configuration: 1, active: 2, finished: 2, abandoned: 1, guestSessions: 2 },
    });
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('game_sessions'));
  });
});
