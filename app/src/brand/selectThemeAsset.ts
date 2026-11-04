export function selectThemeAsset<T>(mode: 'light' | 'dark', light: T, dark: T): T {
  return mode === 'light' ? light : dark;
}
