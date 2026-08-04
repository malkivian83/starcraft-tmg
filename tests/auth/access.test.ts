import { describe, expect, it } from 'vitest';
import { capabilitiesFor } from '@/auth/access';

describe('capacidades por modo de acceso', () => {
  it('limita el invitado al constructor y a formatos portables', () => {
    expect(capabilitiesFor('guest')).toEqual({
      saveRemoteLists: false,
      viewSavedLists: false,
      manageAccount: false,
      usePortableFormats: true,
      printLists: true,
    });
  });

  it('conserva todas las capacidades de una cuenta', () => {
    expect(capabilitiesFor('account')).toEqual({
      saveRemoteLists: true,
      viewSavedLists: true,
      manageAccount: true,
      usePortableFormats: true,
      printLists: true,
    });
  });
});
