import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AuthContext } from './AuthProvider';
import { ProtectedRoute } from '../components/ProtectedRoute';

describe('ProtectedRoute', () => {
  it('redireciona uma sessão sem administrador para o login', () => {
    render(
      <AuthContext.Provider value={{
        user: null,
        accessToken: null,
        signIn: async () => { throw new Error('not used'); },
        signOut: async () => undefined,
      }}>
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route element={<ProtectedRoute />} path="/admin">
              <Route element={<p>Área protegida</p>} index />
            </Route>
            <Route element={<p>Entre para continuar</p>} path="/login" />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    expect(screen.getByText('Entre para continuar')).toBeInTheDocument();
    expect(screen.queryByText('Área protegida')).not.toBeInTheDocument();
  });
});
