import { describe, expect, it } from 'vitest';
import { matchRecordInputSchema } from '../../server/src/modules/lists/match.schema';

describe('validación de registros de partida', () => {
  it('acepta el resultado mínimo y completa los opcionales', () => {
    expect(matchRecordInputSchema.parse({ result: 'WIN' })).toEqual({
      result: 'WIN', playedOn: null, opponentRace: null, opponentFactionCardId: null, opponentName: null,
    });
  });

  it.each([undefined, 'UNKNOWN'])('rechaza un resultado inválido: %s', (result) => {
    expect(matchRecordInputSchema.safeParse({ result }).success).toBe(false);
  });

  it.each(['09/08/2026', '2026-8-9'])('rechaza una fecha con formato incorrecto: %s', (playedOn) => {
    expect(matchRecordInputSchema.safeParse({ result: 'DRAW', playedOn }).success).toBe(false);
  });

  it('recorta el nombre y convierte una cadena vacía en null', () => {
    expect(matchRecordInputSchema.parse({ result: 'LOSS', opponentName: '  Marta  ' }).opponentName).toBe('Marta');
    expect(matchRecordInputSchema.parse({ result: 'LOSS', opponentName: '' }).opponentName).toBeNull();
  });

  it('rechaza un nombre de más de 80 caracteres', () => {
    expect(matchRecordInputSchema.safeParse({ result: 'WIN', opponentName: 'x'.repeat(81) }).success).toBe(false);
  });
});
