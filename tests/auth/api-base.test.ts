import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from '@/auth/apiBase';

describe('base de la API', () => {
  it('usa la ruta relativa en producción si falta la configuración', () => {
    expect(resolveApiBaseUrl(undefined, 'production')).toBe('/api');
  });

  it('evita publicar localhost dentro del bundle de producción', () => {
    expect(resolveApiBaseUrl('http://localhost:3001/api', 'production')).toBe('/api');
    expect(resolveApiBaseUrl('http://127.0.0.1:3001/api/', 'production')).toBe('/api');
  });

  it('mantiene localhost como valor por defecto en desarrollo', () => {
    expect(resolveApiBaseUrl(undefined, 'development')).toBe('http://localhost:3001/api');
  });

  it('conserva una API externa configurada explícitamente', () => {
    expect(resolveApiBaseUrl('https://api.example.test/v1/', 'production')).toBe('https://api.example.test/v1');
  });
});
