import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppTheme, useAppTheme } from './ThemeProvider';
import {
  getContrastRatio,
  resolveThemeMode,
  themeStorageKey,
} from './theme';
import { FullBrand, BrandLockup } from '../components/Brand';

const colors = {
  dark: {
    background: '#040B14',
    surface: '#071B30',
    elevated: '#0C2744',
    border: '#64798E',
    text: '#FFFFFF',
    secondary: '#8FA3BA',
    primary: '#00B6F7',
    start: '#007FA3',
    end: '#006FE0',
    success: '#28DB9E',
    warning: '#E0B24A',
    danger: '#FF6B4A',
  },
  light: {
    background: '#F4F8FC',
    surface: '#FFFFFF',
    elevated: '#EEF4FA',
    border: '#70869D',
    text: '#0B1B2E',
    secondary: '#52667D',
    primary: '#0069D9',
    start: '#007FA3',
    end: '#006FE0',
    success: '#0E7D59',
    warning: '#805400',
    danger: '#C13D22',
  },
};

function ThemeTestControls() {
  const { preference, setPreference } = useAppTheme();
  return (
    <div>
      <button onClick={() => setPreference('dark')} type="button">Escolher escuro</button>
      <span>{preference}</span>
    </div>
  );
}

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('data-theme-mode');
});

describe('tema e contraste', () => {
  it('resolve sistema, claro e escuro', () => {
    expect(resolveThemeMode('system', 'light')).toBe('light');
    expect(resolveThemeMode('light', 'dark')).toBe('light');
    expect(resolveThemeMode('dark', 'light')).toBe('dark');
  });

  it('valida AA de texto, estados, links, gradiente e componentes', () => {
    for (const [mode, palette] of Object.entries(colors)) {
      for (const surface of [palette.background, palette.surface, palette.elevated]) {
        expect(getContrastRatio(palette.text, surface), `${mode} text`).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(palette.secondary, surface), `${mode} secondary`).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(palette.primary, surface), `${mode} links`).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(palette.success, surface), `${mode} success`).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(palette.warning, surface), `${mode} warning`).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(palette.danger, surface), `${mode} error`).toBeGreaterThanOrEqual(4.5);
        expect(getContrastRatio(palette.border, surface), `${mode} border`).toBeGreaterThanOrEqual(3);
      }
      expect(getContrastRatio('#FFFFFF', palette.start)).toBeGreaterThanOrEqual(4.5);
      expect(getContrastRatio('#FFFFFF', palette.end)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('seleciona assets da marca conforme tema e persiste a preferência escolhida', () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    window.localStorage.setItem(themeStorageKey, 'light');

    render(
      <AppTheme>
        <FullBrand />
        <BrandLockup />
        <ThemeTestControls />
      </AppTheme>,
    );

    expect(document.documentElement.dataset.theme).toBe('light');
    expect(screen.getAllByRole('img').every((image) =>
      image.getAttribute('src')?.includes('-claro.png'),
    )).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Escolher escuro' }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem(themeStorageKey)).toBe('dark');
    expect(screen.getAllByRole('img').every((image) =>
      image.getAttribute('src')?.includes('transparente.png'),
    )).toBe(true);
  });
});
