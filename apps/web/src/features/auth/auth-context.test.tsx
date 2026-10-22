// AuthProvider tests for the accounts on/off switch: with accounts turned off
// the provider is guest-only and never restores a stored session.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const apiMock = vi.hoisted(() => ({
  me: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock('../../services/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/api.ts')>();
  return { ...actual, api: apiMock };
});

const { AuthProvider, useAuth } = await import('./auth-context.tsx');

let latest: ReturnType<typeof useAuth> | null = null;

function Probe() {
  latest = useAuth();
  return (
    <p data-testid="probe">
      {String(latest.authEnabled)}|{String(latest.initializing)}|{latest.user?.username ?? 'guest'}
    </p>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    latest = null;
    apiMock.me.mockReset().mockResolvedValue({ id: 'u1', username: 'tester' });
    apiMock.login.mockReset();
    apiMock.register.mockReset();
    localStorage.setItem('pixel-race.token', 'stored-token');
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('restores a stored session when accounts are on', async () => {
    render(
      <AuthProvider enabled>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('probe')).toHaveTextContent('true|false|tester'));
    expect(apiMock.me).toHaveBeenCalledTimes(1);
  });

  it('stays guest-only and ignores the stored token when accounts are off', async () => {
    render(
      <AuthProvider enabled={false}>
        <Probe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('probe')).toHaveTextContent('false|false|guest');
    expect(apiMock.me).not.toHaveBeenCalled();
    // The token is kept so turning accounts back on restores the session.
    expect(localStorage.getItem('pixel-race.token')).toBe('stored-token');

    await expect(latest!.login({ identifier: 'tester', password: 'secret' })).rejects.toThrow();
    await expect(
      latest!.register({ username: 'tester', email: 't@example.com', password: 'secret123' }),
    ).rejects.toThrow();
    expect(apiMock.login).not.toHaveBeenCalled();
    expect(apiMock.register).not.toHaveBeenCalled();
  });
});
