import { describe, expect, it } from 'vitest';
import { isIosUserAgent, isStandaloneDisplayMode } from '@/pwa/installPrompt';

describe('detección de instalación PWA', () => {
  it('reconoce iPhone e iPad por el agente de usuario', () => {
    expect(isIosUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone')).toBe(true);
    expect(isIosUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'iPad')).toBe(true);
    expect(isIosUserAgent('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l')).toBe(false);
  });

  it('no asume que SSR está instalado como aplicación', () => {
    expect(isStandaloneDisplayMode()).toBe(false);
  });
});
