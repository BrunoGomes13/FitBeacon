import { createContext, useContext, type ReactNode } from 'react';
import type { AppTheme } from '../theme';

const ThemeContext = createContext<AppTheme | null>(null);

type ThemeProviderProps = {
  theme: AppTheme;
  children: ReactNode;
};

export function ThemeProvider({ theme, children }: ThemeProviderProps) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): AppTheme {
  const theme = useContext(ThemeContext);

  if (theme === null) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider.');
  }

  return theme;
}
