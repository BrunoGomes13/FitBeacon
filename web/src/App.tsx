import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { AppLayout, AppTheme } from './components/AppLayout';
import { ManagementPage } from './components/ManagementPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { DashboardPage } from './pages/DashboardPage';
import { HeatmapPage } from './pages/HeatmapPage';
import { LoginPage } from './pages/LoginPage';
import { ReportsPage } from './pages/ReportsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'heatmap', element: <HeatmapPage /> },
          { path: 'equipment', element: <ManagementPage kind="equipment" /> },
          { path: 'areas', element: <ManagementPage kind="areas" /> },
          { path: 'exercises', element: <ManagementPage kind="exercises" /> },
          { path: 'reports', element: <ReportsPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate replace to="/" /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppTheme />
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
