import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { AppLayout, AppTheme } from './components/AppLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingState } from './components/shared';
import { ProtectedRoute } from './components/ProtectedRoute';

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const HeatmapPage = lazy(() => import('./pages/HeatmapPage').then((module) => ({ default: module.HeatmapPage })));
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((module) => ({ default: module.ReportsPage })));
const ManagementPage = lazy(() => import('./components/ManagementPage').then((module) => ({ default: module.ManagementPage })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  { path: '/login', element: <Suspense fallback={<LoadingState label="Carregando login" />}><LoginPage /></Suspense> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Suspense fallback={<LoadingState label="Carregando painel" />}><DashboardPage /></Suspense> },
          { path: 'heatmap', element: <Suspense fallback={<LoadingState label="Carregando mapa" />}><HeatmapPage /></Suspense> },
          { path: 'equipment', element: <Suspense fallback={<LoadingState label="Carregando equipamentos" />}><ManagementPage kind="equipment" /></Suspense> },
          { path: 'areas', element: <Suspense fallback={<LoadingState label="Carregando áreas" />}><ManagementPage kind="areas" /></Suspense> },
          { path: 'exercises', element: <Suspense fallback={<LoadingState label="Carregando exercícios" />}><ManagementPage kind="exercises" /></Suspense> },
          { path: 'reports', element: <Suspense fallback={<LoadingState label="Carregando relatórios" />}><ReportsPage /></Suspense> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate replace to="/" /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthProvider>
          <AppTheme />
          <RouterProvider router={router} />
        </AuthProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
