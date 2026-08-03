import { create } from 'zustand';
import * as auth from '@/auth/authService';

type AuthStatus = 'checking' | 'anonymous' | 'unverified' | 'authenticated';

interface AuthState {
  status: AuthStatus;
  user: auth.AuthenticatedUser | null;
  developmentVerificationUrl: string | null;
  emailDeliveryWarning: string | null;
  restore: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  setUser: (user: auth.AuthenticatedUser) => void;
  logout: () => Promise<void>;
}

function stateFor(user: auth.AuthenticatedUser): Pick<AuthState, 'status' | 'user'> {
  return { status: user.emailVerified ? 'authenticated' : 'unverified', user };
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'checking',
  user: null,
  developmentVerificationUrl: null,
  emailDeliveryWarning: null,
  restore: async () => {
    try {
      set({ ...stateFor(await auth.currentUser()), developmentVerificationUrl: null, emailDeliveryWarning: null });
    } catch {
      set({ status: 'anonymous', user: null, developmentVerificationUrl: null, emailDeliveryWarning: null });
    }
  },
  login: async (email, password) => set({ ...stateFor(await auth.login(email, password)), developmentVerificationUrl: null, emailDeliveryWarning: null }),
  register: async (email, password) => {
    const result = await auth.register(email, password);
    set({ status: 'unverified', user: result.user, developmentVerificationUrl: result.developmentVerificationUrl, emailDeliveryWarning: result.emailDeliveryWarning });
  },
  setUser: (user) => set({ ...stateFor(user), developmentVerificationUrl: null, emailDeliveryWarning: null }),
  logout: async () => {
    try { await auth.logout(); } finally { set({ status: 'anonymous', user: null, developmentVerificationUrl: null, emailDeliveryWarning: null }); }
  },
}));
