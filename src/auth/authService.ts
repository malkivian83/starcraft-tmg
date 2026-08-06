export type Race = 'ZERG' | 'TERRAN' | 'PROTOSS';

export type AuthProvider = 'PASSWORD' | 'GOOGLE' | 'BOTH';

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  authProvider: AuthProvider;
  defaultRace: Race;
  nickname: string | null;
  avatar: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  nickname: string | null;
  isActive: boolean;
  emailVerifiedAt: string | null;
  authProvider: AuthProvider;
  lastLoginAt: string | null;
  savedLists: number;
}
export interface SmtpSettings { host: string; port: number; secure: boolean; username: string; from: string; passwordConfigured: boolean; password?: string; }
export interface EmailDeliveryLog {
  id: number;
  recipient: string;
  messageType: 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'SMTP_TEST' | 'ACCOUNT_VERIFIED' | 'SUPPORT_CREATED' | 'SUPPORT_REPLY';
  subject: string;
  status: 'SENT' | 'FAILED';
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export type SupportStatus = 'OPEN' | 'ANSWERED' | 'CLOSED';
export interface SupportMessage {
  id: string;
  ticketId: string;
  authorType: 'USER' | 'ADMIN';
  authorUserId: string | null;
  body: string;
  deliveryStatus: 'PENDING' | 'SENT' | 'FAILED' | 'NOT_APPLICABLE';
  providerMessageId: string | null;
  deliveryError: string | null;
  deliveredAt: string | null;
  createdAt: string;
}
export interface SupportTicket {
  id: string;
  userId: string | null;
  contactEmail: string;
  subject: string;
  status: SupportStatus;
  termsVersion: string;
  termsAcceptedAt: string;
  createdAt: string;
  updatedAt: string;
  messages?: SupportMessage[];
}

export interface RegistrationResult {
  user: AuthenticatedUser;
  developmentVerificationUrl: string | null;
  emailDeliveryWarning: string | null;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

const avatarDataUrlPattern = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
const avatarPathPattern = /^\/auth\/avatars\/[0-9a-f-]{36}\.(?:png|jpe?g|webp)$/i;

export function avatarUrl(value: string | null): string | null {
  if (!value) return null;
  if (avatarDataUrlPattern.test(value)) return value;
  if (avatarPathPattern.test(value)) return `${apiBaseUrl.replace(/\/$/, '')}${value}`;
  return null;
}

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  let response: Response;
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: controller.signal,
    });
  } catch {
    if (controller.signal.aborted) {
      throw new ApiError(0, `El servidor no respondió en ${Math.round(timeoutMs / 1000)} segundos. Revisa los registros del servidor y la conectividad SMTP.`);
    }
    throw new ApiError(0, 'No se puede conectar con el servidor de la aplicación.');
  } finally {
    globalThis.clearTimeout(timeout);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new ApiError(response.status, payload?.error?.message ?? 'No se pudo completar la solicitud.');
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function currentUser(): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/me')).user;
}

export async function login(email: string, password: string): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  })).user;
}

export async function register(email: string, password: string): Promise<RegistrationResult> {
  return request<RegistrationResult>('/auth/register', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
}

export async function loginWithGoogle(credential: string): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/google', {
    method: 'POST', body: JSON.stringify({ credential }),
  })).user;
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

export async function refreshSession(): Promise<void> {
  await request('/auth/refresh', { method: 'POST' });
}

export async function verifyEmail(token: string): Promise<void> {
  await request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
}

export async function requestVerification(email: string): Promise<void> {
  await request('/auth/request-verification', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await request('/auth/request-password-reset', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function resetPassword(token: string, password: string): Promise<void> {
  await request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) });
}

export async function updateDefaultRace(defaultRace: Race): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/profile/default-race', {
    method: 'PUT', body: JSON.stringify({ defaultRace }),
  })).user;
}

export async function updateProfile(profile: Pick<AuthenticatedUser, 'defaultRace' | 'nickname' | 'avatar'>): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/profile', {
    method: 'PUT', body: JSON.stringify(profile),
  })).user;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
}

export async function setPassword(credential: string, newPassword: string): Promise<AuthenticatedUser> {
  return (await request<{ user: AuthenticatedUser }>('/auth/set-password', {
    method: 'POST', body: JSON.stringify({ credential, newPassword }),
  })).user;
}

export async function deleteAccount(reauthentication: { password: string } | { credential: string }): Promise<void> {
  await request('/auth/account', { method: 'DELETE', body: JSON.stringify(reauthentication) });
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  return (await request<{ users: AdminUser[] }>('/admin/users')).users;
}

export async function setAdminUserActive(id: string, isActive: boolean): Promise<void> {
  await request(`/admin/users/${id}/active`, { method: 'PUT', body: JSON.stringify({ isActive }) });
}

export async function setAdminUserVerified(id: string, isVerified: boolean): Promise<{ emailDeliveryWarning: string | null }> {
  return request(`/admin/users/${id}/verified`, { method: 'PUT', body: JSON.stringify({ isVerified }) });
}

export async function setAdminUserPassword(id: string, password: string): Promise<void> {
  await request(`/admin/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) });
}
export async function getSmtpSettings(): Promise<SmtpSettings | null> { return (await request<{ smtp: SmtpSettings | null }>('/admin/smtp')).smtp; }
export async function saveSmtpSettings(settings: Omit<SmtpSettings, 'passwordConfigured'>): Promise<void> { await request('/admin/smtp', { method: 'PUT', body: JSON.stringify(settings) }); }
export interface SmtpTestResult { ok: boolean; messageId: string | null; accepted: string[]; rejected: string[]; response: string | null; }
export async function testSmtpSettings(recipient: string): Promise<SmtpTestResult> {
  return (await request<{ result: SmtpTestResult }>('/admin/smtp/test', {
    method: 'POST', body: JSON.stringify({ recipient }),
  }, 40_000)).result;
}
export async function getEmailDeliveryLogs(limit = 100): Promise<EmailDeliveryLog[]> {
  return (await request<{ logs: EmailDeliveryLog[] }>(`/admin/smtp/logs?limit=${limit}`)).logs;
}

export interface SupportCreationResult { ticketId: string; emailDeliveryWarning: string | null; }
export async function createSupport(input: { subject: string; contactEmail: string; message: string; termsAccepted: boolean }): Promise<SupportCreationResult> {
  return request<SupportCreationResult>('/support', { method: 'POST', body: JSON.stringify(input) });
}
export async function listSupportTickets(status?: SupportStatus): Promise<{ tickets: SupportTicket[]; openCount: number }> {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return request<{ tickets: SupportTicket[]; openCount: number }>(`/admin/support${query}`);
}
export async function getSupportTicket(id: string): Promise<SupportTicket> {
  return (await request<{ ticket: SupportTicket }>(`/admin/support/${encodeURIComponent(id)}`)).ticket;
}
export async function replyToSupport(id: string, body: string): Promise<{ message: SupportMessage | null; emailDeliveryWarning: string | null }> {
  return request<{ message: SupportMessage | null; emailDeliveryWarning: string | null }>(`/admin/support/${encodeURIComponent(id)}/replies`, { method: 'POST', body: JSON.stringify({ body }) });
}
export async function setSupportStatus(id: string, status: SupportStatus): Promise<void> {
  await request(`/admin/support/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
}
