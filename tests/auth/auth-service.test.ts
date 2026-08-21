import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentUser } from '@/auth/authService';

describe('cliente de autenticación', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('no permite que el navegador reutilice una respuesta antigua de /auth/me', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ user: { id: 'user-1' } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    await currentUser();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
  });
});
