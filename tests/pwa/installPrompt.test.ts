import { describe, expect, it } from 'vitest';
import { isIosUserAgent, isMobileInstallDevice, isStandaloneDisplayMode } from '@/pwa/installPrompt';

describe('detección de instalación PWA', () => {
  it('reconoce iPhone e iPad por el agente de usuario', () => {
    expect(isIosUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone')).toBe(true);
    expect(isIosUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'iPad')).toBe(true);
    expect(isIosUserAgent('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l')).toBe(false);
  });

  it('solo considera móviles aptos para promocionar la instalación', () => {
    expect(isMobileInstallDevice('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l')).toBe(true);
    expect(isMobileInstallDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32')).toBe(false);
  });

  it('no asume que SSR está instalado como aplicación', () => {
    expect(isStandaloneDisplayMode()).toBe(false);
  });
});
