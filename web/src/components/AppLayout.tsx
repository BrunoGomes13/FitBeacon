import {
  Activity,
  BarChart3,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Menu,
  Map,
  Moon,
  Sun,
  X,
  UsersRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { DeleteQueueProvider } from './DeleteQueueProvider';

const navItems = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/heatmap', label: 'Mapa de calor', icon: Map, end: false },
  { to: '/equipment', label: 'Equipamentos', icon: Dumbbell, end: false },
  { to: '/areas', label: 'Áreas', icon: UsersRound, end: false },
  { to: '/exercises', label: 'Exercícios', icon: Activity, end: false },
  { to: '/reports', label: 'Relatórios', icon: BarChart3, end: false },
];

function Navigation({ mobile = false }: { mobile?: boolean }) {
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <>
      <nav aria-label="Navegação principal" className={mobile ? 'bottom-nav' : 'mt-8 grid gap-1'}>
        {navItems.slice(0, mobile ? 4 : navItems.length).map(({ to, label, icon: Icon, end }) => (
          <NavLink aria-label={label} className="nav-link" end={end} key={to} to={to} title={label}>
            <Icon aria-hidden="true" size={18} />
            <span className={mobile ? '' : 'sidebar-label'}>{label}</span>
          </NavLink>
        ))}
        {mobile ? (
          <button
            aria-controls="mobile-more-menu"
            aria-expanded={moreOpen}
            className="nav-link"
            onClick={() => setMoreOpen((open) => !open)}
            type="button"
          >
            {moreOpen ? <X aria-hidden="true" size={18} /> : <Menu aria-hidden="true" size={18} />}
            <span>Mais</span>
          </button>
        ) : null}
      </nav>
      {mobile && moreOpen ? (
        <nav aria-label="Mais opções" className="panel fixed inset-x-3 bottom-24 z-40 grid max-h-[60dvh] gap-1 overflow-y-auto p-2" id="mobile-more-menu">
          {navItems.slice(4).map(({ to, label, icon: Icon, end }) => (
            <NavLink className="nav-link" end={end} key={to} onClick={() => setMoreOpen(false)} to={to}>
              <Icon aria-hidden="true" size={18} /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
      ) : null}
    </>
  );
}

export function AppLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system');
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const setThemeMode = (next: 'system' | 'light' | 'dark'): void => {
    setTheme(next);
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    const active = next === 'system' ? (prefersLight ? 'light' : 'dark') : next;
    document.documentElement.dataset.theme = active;
    document.documentElement.dataset.themeMode = next === 'system' ? 'system' : 'explicit';
  };

  const toggleTheme = (): void => {
    const active = document.documentElement.dataset.theme ?? 'dark';
    setThemeMode(active === 'dark' ? 'light' : 'dark');
  };

  const logout = async (): Promise<void> => {
    setLogoutError(null);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão no servidor.');
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link aria-label="FitBeacon, início" className="flex items-center gap-3 text-inherit no-underline" to="/">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"><Activity aria-hidden="true" size={21} /></span>
          <span className="brand-copy min-w-0">
            <strong className="block truncate">FitBeacon</strong>
            <span className="text-xs text-muted">Painel da academia</span>
          </span>
        </Link>
        <Navigation />
        <div className="mt-auto grid gap-3 border-t border-border pt-4">
          <span className="sidebar-footer-copy truncate text-xs text-muted">{user?.name}</span>
          <button aria-label="Alternar tema claro/escuro" className="btn btn-secondary w-full" onClick={toggleTheme} type="button">
            {theme === 'light' ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
            <span className="sidebar-label">Alternar tema</span>
          </button>
          <button className="btn btn-ghost w-full" onClick={() => void logout()} type="button">
            <LogOut aria-hidden="true" size={16} /><span className="sidebar-label">Sair</span>
          </button>
          {logoutError ? <p className="m-0 text-xs text-danger" role="alert">{logoutError}</p> : null}
        </div>
      </aside>
      <div className="main-area">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-7">
          <span className="font-semibold sm:hidden">FitBeacon</span>
          <span className="hidden text-sm text-muted sm:inline">{user?.name} · Administrador</span>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <button aria-label="Alternar tema claro/escuro" className="btn btn-ghost min-h-10 px-3" onClick={toggleTheme} type="button">
              <Moon aria-hidden="true" size={17} />
            </button>
            <button aria-label="Sair" className="btn btn-ghost min-h-10 px-3 sm:hidden" onClick={() => void logout()} type="button"><LogOut aria-hidden="true" size={17} /></button>
          </div>
        </header>
        {logoutError ? <p className="mx-4 mt-4 rounded-md bg-danger/10 p-3 text-sm text-danger sm:mx-7" role="alert">{logoutError}</p> : null}
        <main className="content">
          <DeleteQueueProvider>
            <Outlet />
          </DeleteQueueProvider>
        </main>
      </div>
      <Navigation mobile />
    </div>
  );
}

export function AppTheme() {
  useEffect(() => {
    const query = window.matchMedia('(prefers-color-scheme: light)');
    document.documentElement.dataset.theme = query.matches ? 'light' : 'dark';
    const update = (event: MediaQueryListEvent): void => {
      if (document.documentElement.dataset.themeMode !== 'explicit') {
        document.documentElement.dataset.theme = event.matches ? 'light' : 'dark';
      }
    };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return null;
}
