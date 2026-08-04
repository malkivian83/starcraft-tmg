export type AccessMode = 'guest' | 'account';

export interface AccessCapabilities {
  saveRemoteLists: boolean;
  viewSavedLists: boolean;
  manageAccount: boolean;
  usePortableFormats: boolean;
  printLists: boolean;
}

const CAPABILITIES: Record<AccessMode, AccessCapabilities> = {
  guest: {
    saveRemoteLists: false,
    viewSavedLists: false,
    manageAccount: false,
    usePortableFormats: true,
    printLists: true,
  },
  account: {
    saveRemoteLists: true,
    viewSavedLists: true,
    manageAccount: true,
    usePortableFormats: true,
    printLists: true,
  },
};

export function capabilitiesFor(mode: AccessMode): AccessCapabilities {
  return CAPABILITIES[mode];
}
