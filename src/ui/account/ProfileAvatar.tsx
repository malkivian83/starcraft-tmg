import { avatarUrl, type AuthenticatedUser } from '@/auth/authService';

export const AVATAR_OPTIONS = ['🛰️', '👾', '🛡️', '⚔️', '🧬', '🌌'] as const;

export function profileName(user: Pick<AuthenticatedUser, 'email' | 'nickname'>): string {
  return user.nickname?.trim() || user.email.split('@')[0] || 'Jugador';
}

export function isUploadedAvatar(avatar: string | null): avatar is string {
  return avatarUrl(avatar) !== null;
}

export function isEmojiAvatar(avatar: string | null): boolean {
  return avatar !== null && AVATAR_OPTIONS.some((option) => option === avatar);
}

export function ProfileAvatar({ user, className = '' }: { user: Pick<AuthenticatedUser, 'email' | 'nickname' | 'avatar'>; className?: string }) {
  const imageUrl = avatarUrl(user.avatar);
  const fallback = isEmojiAvatar(user.avatar) ? user.avatar : profileName(user).slice(0, 1).toUpperCase();
  return <span className={`profile-avatar ${className}`} aria-hidden="true">
    {imageUrl
      ? <img src={imageUrl} alt="" decoding="async" />
      : fallback}
  </span>;
}
