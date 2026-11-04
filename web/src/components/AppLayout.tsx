import {
  Activity,
  BarChart3,
  Dumbbell,
  LayoutDashboard,
  LogOut,
  Menu,
  Map,
  X,
  UsersRound,
  MapPinned,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { DeleteQueueProvider } from './DeleteQueueProvider';
import { BrandLockup } from './Brand';
import { useAppTheme } from '../design/ThemeProvider';
import type { ThemePreference } from '../design/theme';

const navItems = [
  { to: '/', label: 'Visão geral', icon: LayoutDashboard, end: true },
  { to: '/heatmap', label: 'Mapa de calor', icon: Map, end: false },
  { to: '/gym-map', label: 'Mapa da academia', icon: MapPinned, end: false },
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
  const { preference, setPreference } = useAppTheme();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  const themePicker = (className = '') => (
    <select
      aria-label="Tema"
      className={`theme-select ${className}`}
      onChange={(event) => setPreference(event.target.value as ThemePreference)}
      value={preference}
    >
      <option value="system">Sistema</option>
      <option value="light">Claro</option>
      <option value="dark">Escuro</option>
    </select>
  );

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
          <BrandLockup className="brand-lockup-sidebar" />
        </Link>
        <Navigation />
        <div className="mt-auto grid gap-3 border-t border-border pt-4">
          <span className="sidebar-footer-copy truncate text-xs text-muted">{user?.name}</span>
          {themePicker()}
          <button className="btn btn-logout w-full" onClick={() => void logout()} type="button">
            <LogOut aria-hidden="true" size={16} /><span className="sidebar-label">Sair</span>
          </button>
          {logoutError ? <p className="m-0 text-xs text-danger" role="alert">{logoutError}</p> : null}
        </div>
      </aside>
      <div className="main-area">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-7">
          <BrandLockup className="brand-lockup-mobile sm:hidden" />
          <span className="hidden text-sm text-muted sm:inline">{user?.name} · Administrador</span>
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            {themePicker('theme-select-compact')}
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
