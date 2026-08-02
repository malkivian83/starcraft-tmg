import type { AuthenticatedUser } from '@/auth/authService';

export const AVATAR_OPTIONS = ['🛰️', '👾', '🛡️', '⚔️', '🧬', '🌌'] as const;

export function profileName(user: Pick<AuthenticatedUser, 'email' | 'nickname'>): string {
  return user.nickname?.trim() || user.email.split('@')[0] || 'Jugador';
}

export function ProfileAvatar({ user, className = '' }: { user: Pick<AuthenticatedUser, 'email' | 'nickname' | 'avatar'>; className?: string }) {
  return <span className={`profile-avatar ${className}`} aria-hidden="true">{user.avatar ?? profileName(user).slice(0, 1).toUpperCase()}</span>;
}
