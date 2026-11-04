export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemeMode = Exclude<ThemePreference, 'system'>;

export const themeStorageKey = 'fitbeacon-theme-preference';

export function resolveThemeMode(
  preference: ThemePreference,
  systemMode: ThemeMode,
): ThemeMode {
  return preference === 'system' ? systemMode : preference;
}

export function selectThemeAsset<T>(mode: ThemeMode, light: T, dark: T): T {
  return mode === 'light' ? light : dark;
}

export function getContrastRatio(foreground: string, background: string): number {
  const luminance = (color: string): number => {
    const channels = [1, 3, 5].map((offset) => {
      const channel = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
