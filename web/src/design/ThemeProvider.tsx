import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  resolveThemeMode,
  themeStorageKey,
  type ThemeMode,
  type ThemePreference,
} from './theme';

type ThemeContextValue = {
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(themeStorageKey);
    return stored === 'light' || stored === 'dark' || stored === 'system'
      ? stored
      : 'system';
  } catch {
    return 'system';
  }
}

export function AppTheme({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState(readThemePreference);
  const [systemMode, setSystemMode] = useState<ThemeMode>(() =>
    window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
  );
  const mode = resolveThemeMode(preference, systemMode);

  const setPreference = (next: ThemePreference): void => {
    setPreferenceState(next);
    try {
      window.localStorage.setItem(themeStorageKey, next);
    } catch {
      // The in-memory choice still applies for this session.
    }
  };

  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    const updateSystemMode = (event: MediaQueryListEvent): void => {
      setSystemMode(event.matches ? 'light' : 'dark');
    };
    query.addEventListener('change', updateSystemMode);
    return () => query.removeEventListener('change', updateSystemMode);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.dataset.themeMode = preference;
  }, [mode, preference]);

  const value = useMemo(
    () => ({ mode, preference, setPreference }),
    [mode, preference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme(): ThemeContextValue {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useAppTheme deve ser usado dentro de AppTheme.');
  return value;
}
