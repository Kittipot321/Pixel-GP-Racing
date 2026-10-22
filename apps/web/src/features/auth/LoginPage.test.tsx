// Login form validation test.
//
// Submitting with empty fields must surface a validation error and must NOT
// call the auth login function. A valid submit calls login once.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../test-support/render.tsx';

const loginMock = vi.fn();

vi.mock('./auth-context.tsx', () => ({
  useAuth: () => ({
    authEnabled: true,
    user: null,
    initializing: false,
    isAuthenticated: false,
    login: loginMock,
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

const { LoginPage } = await import('./LoginPage.tsx');

describe('LoginPage validation', () => {
  beforeEach(() => {
    loginMock.mockReset();
  });

  it('shows a validation error and does not call login on empty submit', async () => {
    renderWithProviders(<LoginPage />);

    fireEvent.click(screen.getByTestId('login-submit'));

    expect(await screen.findByTestId('login-error')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('calls login with valid credentials', async () => {
    loginMock.mockResolvedValue(undefined);
    renderWithProviders(<LoginPage />);

    fireEvent.change(screen.getByTestId('login-identifier'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByTestId('login-submit'));

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
    expect(loginMock).toHaveBeenCalledWith({ identifier: 'alice', password: 'password123' });
  });
});
