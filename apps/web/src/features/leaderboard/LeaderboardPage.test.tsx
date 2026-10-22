// Leaderboard render test: mocks the API and asserts rows render with rank,
// username, and points.

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../test-support/render.tsx';

vi.mock('../../services/api.ts', () => ({
  api: {
    leaderboard: vi.fn().mockResolvedValue({
      items: [
        { rank: 1, userId: 'u1', username: 'ace', totalPoints: 9 },
        { rank: 2, userId: 'u2', username: 'bob', totalPoints: 4 },
      ],
      page: 1,
      pageSize: 10,
      total: 2,
    }),
  },
  ApiRequestError: class extends Error {},
}));

const { LeaderboardPage } = await import('./LeaderboardPage.tsx');

describe('LeaderboardPage', () => {
  it('renders ranked rows from the API', async () => {
    renderWithProviders(<LeaderboardPage />);

    expect(await screen.findByTestId('leaderboard-table')).toBeInTheDocument();
    expect(screen.getByTestId('leaderboard-row-u1')).toHaveTextContent('ace');
    expect(screen.getByTestId('leaderboard-row-u1')).toHaveTextContent('9');
    expect(screen.getByTestId('leaderboard-row-u2')).toHaveTextContent('bob');
  });
});
