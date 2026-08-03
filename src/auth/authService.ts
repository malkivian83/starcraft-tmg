export type Race = 'ZERG' | 'TERRAN' | 'PROTOSS';

export interface AuthenticatedUser {
  id: string;
  email: string;
  emailVerified: boolean;
  defaultRace: Race;
  nickname: string | null;
  avatar: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  nickname: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  savedLists: number;
}
export interface SmtpSettings { host: string; port: number; secure: boolean; username: string; from: string; passwordConfigured: boolean; password?: string; }
export interface EmailDeliveryLog {
  id: number;
  recipient: string;
  messageType: 'VERIFY_EMAIL' | 'RESET_PASSWORD' | 'SMTP_TEST';
  subject: string;
  status: 'SENT' | 'FAILED';
  providerMessageId: string | null;
  errorMessage: string | null;
  createdAt: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'No se puede conectar con el servidor de la aplicación.');
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

export async function register(email: string, password: string): Promise<string | null> {
  const result = await request<{ developmentVerificationUrl: string | null }>('/auth/register', {
    method: 'POST', body: JSON.stringify({ email, password }),
  });
  return result.developmentVerificationUrl;
}

export async function logout(): Promise<void> {
  await request('/auth/logout', { method: 'POST' });
}

export async function verifyEmail(token: string): Promise<void> {
  await request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
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

export async function deleteAccount(password: string): Promise<void> {
  await request('/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) });
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  return (await request<{ users: AdminUser[] }>('/admin/users')).users;
}

export async function setAdminUserActive(id: string, isActive: boolean): Promise<void> {
  await request(`/admin/users/${id}/active`, { method: 'PUT', body: JSON.stringify({ isActive }) });
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
  })).result;
}
export async function getEmailDeliveryLogs(limit = 100): Promise<EmailDeliveryLog[]> {
  return (await request<{ logs: EmailDeliveryLog[] }>(`/admin/smtp/logs?limit=${limit}`)).logs;
}
