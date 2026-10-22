// PlayPage tests.
//
// Mocks the API, the auth context, and the Phaser GameCanvas (so no real game
// boots — instead we expose a button to fire onRaceFinished, and a ref handle
// whose unlockAudio is a spy). Covers the round dialog flow:
//   - logged-in: "เริ่มรอบใหม่" opens the dialog; picking a car closes it and
//     shows the guess panel (car, "เปลี่ยนรถ", "ส่งคำทาย") in the center of the
//     track; "ส่งคำทาย" only opens the confirm step; while racing the corner
//     shows the submitted car and "รอผลการแข่ง…"; "ยืนยันคำตอบ" unlocks audio first, then calls guess →
//     start → settle in order, closes the dialog, and runs the race; back lets
//     the player change the car; a failed start shows an error, locks back, and
//     a retry resumes without re-sending the guess; Esc closes before confirm;
//     there is no "เริ่มแข่ง" button; next race opens a fresh dialog;
//   - guest: a full round (with back) runs without any API call or storage
//     write, shows the outcome without points plus a signup invite; next race
//     works; the page waits while the session is still being verified.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import type { GameCanvasHandle, GameCanvasProps } from '../../game/GameCanvas.tsx';
import { renderWithProviders } from '../../test-support/render.tsx';

/** Order of audio unlock and API calls, to check NFR3. */
const callOrder: string[] = [];

const apiMock = {
  createRace: vi.fn(),
  submitGuess: vi.fn(),
  startRace: vi.fn(),
  settleRace: vi.fn(),
};

vi.mock('../../services/api.ts', () => ({
  api: apiMock,
  ApiRequestError: class ApiRequestError extends Error {
    isAuthError = false;
  },
}));

// Mutable auth state so each describe block can pick logged-in or guest.
const authState: {
  authEnabled: boolean;
  user: { username: string } | null;
  isAuthenticated: boolean;
  initializing: boolean;
} = { authEnabled: true, user: null, isAuthenticated: false, initializing: false };
const logoutMock = vi.fn();

vi.mock('../auth/auth-context.tsx', () => ({
  useAuth: () => ({ ...authState, logout: logoutMock }),
}));

const unlockAudio = vi.fn(() => {
  callOrder.push('unlock');
});

// Replace the Phaser wrapper with a stub that lets the test trigger the
// "race finished" callback deterministically, exposes the winner it was given,
// and offers the same ref handle as the real canvas.
vi.mock('../../game/GameCanvas.tsx', async () => {
  const { forwardRef, useImperativeHandle } = await import('react');
  const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(function StubCanvas(
    { onRaceFinished, winnerColor, overlay, topLeft, children },
    ref,
  ) {
    useImperativeHandle(ref, () => ({ unlockAudio }), []);
    return (
      <div data-testid="stub-canvas">
        <button
          type="button"
          data-testid="stub-finish"
          data-winner={winnerColor ?? ''}
          onClick={() => onRaceFinished?.()}
        >
          finish
        </button>
        {overlay && <div data-testid="game-overlay">{overlay}</div>}
        {topLeft && <div data-testid="game-top-left">{topLeft}</div>}
        {children}
      </div>
    );
  });
  return { GameCanvas };
});

const { PlayPage } = await import('./PlayPage.tsx');

function resetMocks() {
  callOrder.length = 0;
  unlockAudio.mockClear();
  apiMock.createRace.mockReset();
  apiMock.submitGuess.mockReset();
  apiMock.startRace.mockReset();
  apiMock.settleRace.mockReset();
}

/** Default successful member API, recording call order. */
function mockMemberApi(winnerColor: 'RED' | 'BLUE' = 'RED') {
  let raceNo = 0;
  apiMock.createRace.mockImplementation(async () => {
    callOrder.push('create');
    raceNo += 1;
    return { id: `r${raceNo}`, status: 'OPEN', winnerColor: null };
  });
  apiMock.submitGuess.mockImplementation(async (raceId: string, guessedColor: string) => {
    callOrder.push('guess');
    return { raceId, guessedColor, status: 'accepted' };
  });
  apiMock.startRace.mockImplementation(async (raceId: string) => {
    callOrder.push('start');
    return { id: raceId, status: 'RUNNING', winnerColor: null };
  });
  apiMock.settleRace.mockImplementation(async (raceId: string) => {
    callOrder.push('settle');
    return { raceId, winnerColor, guessedColor: 'RED', isCorrect: true, pointsAwarded: 1 };
  });
}

function expectNoRaceStartButton() {
  expect(screen.queryByRole('button', { name: /เริ่มแข่ง/ })).not.toBeInTheDocument();
}

describe('PlayPage', () => {
  beforeEach(() => {
    resetMocks();
    authState.authEnabled = true;
    authState.user = { username: 'tester' };
    authState.isAuthenticated = true;
    authState.initializing = false;
  });

  it('opens the round dialog, confirms guess → start → settle, and shows the server result', async () => {
    mockMemberApi();
    renderWithProviders(<PlayPage />);

    fireEvent.click(screen.getByTestId('start-new-race'));
    await screen.findByTestId('round-modal');
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByTestId('guessing-panel')).toBeInTheDocument();

    // No submit button until a car is picked.
    expect(screen.queryByTestId('submit-guess')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('car-option-RED'));

    // Picking closes the dialog; the guess panel waits in the center of the track.
    expect(screen.queryByTestId('round-modal')).not.toBeInTheDocument();
    const center = screen.getByTestId('game-overlay');
    expect(center).toContainElement(screen.getByTestId('submit-guess'));
    expect(center).toContainElement(screen.getByTestId('change-car'));
    expect(screen.queryByTestId('game-top-left')).not.toBeInTheDocument();
    expect(screen.getByTestId('guess-bar-car')).toHaveTextContent('แดง');
    expect(screen.queryByTestId('start-new-race')).not.toBeInTheDocument();

    // "ส่งคำทาย" only moves to the confirm step: nothing is sent yet.
    fireEvent.click(screen.getByTestId('submit-guess'));
    expect(screen.getByTestId('guess-accepted')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-choice')).toHaveTextContent('แดง');
    expect(apiMock.submitGuess).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'ยืนยันคำตอบ' })).toBeInTheDocument();
    expectNoRaceStartButton();

    // Confirm → guess, start, settle in order; the dialog closes and the race runs.
    fireEvent.click(screen.getByTestId('begin-race'));
    await screen.findByTestId('guess-bar-waiting');
    expect(callOrder).toEqual(['create', 'unlock', 'guess', 'start', 'settle']);
    expect(apiMock.submitGuess).toHaveBeenCalledWith('r1', 'RED');
    expect(screen.queryByTestId('round-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('stub-finish')).toHaveAttribute('data-winner', 'RED');

    // While racing, the corner keeps the submitted car and waits for the result.
    const waitingCorner = screen.getByTestId('game-top-left');
    expect(waitingCorner).toContainElement(screen.getByTestId('guess-bar-waiting'));
    expect(screen.getByTestId('guess-bar-waiting')).toHaveTextContent('รอผลการแข่ง');
    expect(screen.getByTestId('guess-bar-car')).toHaveTextContent('แดง');
    expect(screen.queryByTestId('submit-guess')).not.toBeInTheDocument();
    expect(screen.queryByTestId('change-car')).not.toBeInTheDocument();

    // Animation finishes → result panel shows server points; the waiting bar goes.
    fireEvent.click(screen.getByTestId('stub-finish'));
    expect(await screen.findByTestId('result-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('guess-bar')).not.toBeInTheDocument();
    // Points are intentionally hidden from the result dialog.
    expect(screen.queryByTestId('result-points')).not.toBeInTheDocument();
    expect(screen.getByTestId('result-outcome')).toHaveTextContent('ถูก');
    expectNoRaceStartButton();
  });

  it('unlocks audio in the confirm click before the first API call', async () => {
    mockMemberApi();
    // Hold the guess request so we can look at the order mid-click.
    let releaseGuess: () => void = () => {};
    apiMock.submitGuess.mockImplementation(
      () =>
        new Promise((resolve) => {
          callOrder.push('guess');
          releaseGuess = () => resolve({ raceId: 'r1', guessedColor: 'RED', status: 'accepted' });
        }),
    );
    renderWithProviders(<PlayPage />);

    fireEvent.click(screen.getByTestId('start-new-race'));
    await screen.findByTestId('round-modal');
    fireEvent.click(screen.getByTestId('car-option-RED'));
    fireEvent.click(screen.getByTestId('submit-guess'));

    fireEvent.click(screen.getByTestId('begin-race'));
    // unlockAudio ran synchronously inside the click, before any request.
    expect(unlockAudio).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['create', 'unlock']);

    await waitFor(() => expect(callOrder).toEqual(['create', 'unlock', 'guess']));
    // While the request runs, the dialog cannot be closed or stepped back.
    expect(screen.getByTestId('round-modal-close')).toBeDisabled();
    expect(screen.getByTestId('round-back')).toBeDisabled();
    releaseGuess();
    await screen.findByTestId('guess-bar-waiting');
  });

  it('goes back to change the car, and saves only the last choice', async () => {
    mockMemberApi();
    renderWithProviders(<PlayPage />);

    fireEvent.click(screen.getByTestId('start-new-race'));
    await screen.findByTestId('round-modal');
    fireEvent.click(screen.getByTestId('car-option-RED'));
    fireEvent.click(screen.getByTestId('submit-guess'));

    fireEvent.click(screen.getByTestId('round-back'));
    expect(screen.getByTestId('guessing-panel')).toBeInTheDocument();
    // The earlier choice is still selected and another car can be picked.
    expect(screen.getByTestId('car-option-RED')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('car-option-BLUE'));
    fireEvent.click(screen.getByTestId('submit-guess'));
    expect(screen.getByTestId('confirm-choice')).toHaveTextContent('น้ำเงิน');
    expect(apiMock.submitGuess).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('begin-race'));
    await screen.findByTestId('guess-bar-waiting');
    expect(apiMock.submitGuess).toHaveBeenCalledTimes(1);
    expect(apiMock.submitGuess).toHaveBeenCalledWith('r1', 'BLUE');
  });

  it('keeps the dialog open after a failed start and resumes without re-sending the guess', async () => {
    mockMemberApi();
    apiMock.startRace.mockRejectedValueOnce(new Error('network down'));
    renderWithProviders(<PlayPage />);

    fireEvent.click(screen.getByTestId('start-new-race'));
    await screen.findByTestId('round-modal');
    fireEvent.click(screen.getByTestId('car-option-RED'));
    fireEvent.click(screen.getByTestId('submit-guess'));
    fireEvent.click(screen.getByTestId('begin-race'));

    // The error shows inside the open dialog; back is locked to the saved guess.
    expect(await screen.findByTestId('play-error')).toHaveTextContent('ยืนยันคำตอบไม่สำเร็จ');
    expect(screen.getByTestId('round-modal')).toContainElement(screen.getByTestId('play-error'));
    expect(screen.getByTestId('round-back')).toBeDisabled();
    expect(screen.getByTestId('begin-race')).toBeEnabled();
    expect(screen.queryByTestId('guess-bar-waiting')).not.toBeInTheDocument();

    // Retry resumes at start: the guess is not sent again.
    fireEvent.click(screen.getByTestId('begin-race'));
    await screen.findByTestId('guess-bar-waiting');
    expect(apiMock.submitGuess).toHaveBeenCalledTimes(1);
    expect(apiMock.startRace).toHaveBeenCalledTimes(2);
    expect(apiMock.settleRace).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('round-modal')).not.toBeInTheDocument();
  });

  it('closes the dialog with Esc before a pick, without starting a race', async () => {
    mockMemberApi();
    renderWithProviders(<PlayPage />);

    fireEvent.click(screen.getByTestId('start-new-race'));
    await screen.findByTestId('round-modal');

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByTestId('round-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('start-new-race')).toBeInTheDocument();
    expect(screen.queryByTestId('guess-bar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guess-bar-waiting')).not.toBeInTheDocument();
    expect(apiMock.submitGuess).not.toHaveBeenCalled();
    expect(unlockAudio).not.toHaveBeenCalled();
  });

  it('opens a fresh dialog with car selection unlocked after clicking next race', async () => {
    mockMemberApi();
    renderWithProviders(<PlayPage />);

    // Play round 1 to completion.
    fireEvent.click(screen.getByTestId('start-new-race'));
    await screen.findByTestId('round-modal');
    fireEvent.click(screen.getByTestId('car-option-RED'));
    fireEvent.click(screen.getByTestId('submit-guess'));
    fireEvent.click(screen.getByTestId('begin-race'));
    await screen.findByTestId('guess-bar-waiting');
    fireEvent.click(screen.getByTestId('stub-finish'));
    await screen.findByTestId('result-panel');

    // Next round: a new race and a fresh dialog with every car clickable.
    fireEvent.click(screen.getByTestId('next-race'));
    await screen.findByTestId('round-modal');
    expect(apiMock.createRace).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('car-option-BLUE')).toBeEnabled();
    expect(screen.getByTestId('car-option-RED')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('submit-guess')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guess-accepted')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('car-option-BLUE'));
    expect(screen.getByTestId('guess-bar-car')).toHaveTextContent('น้ำเงิน');
    expect(screen.getByTestId('submit-guess')).toBeEnabled();
  });

  it('reopens the picker from the guess bar with the car still selected', async () => {
    mockMemberApi();
    renderWithProviders(<PlayPage />);

    fireEvent.click(screen.getByTestId('start-new-race'));
    await screen.findByTestId('round-modal');
    fireEvent.click(screen.getByTestId('car-option-RED'));

    fireEvent.click(screen.getByTestId('change-car'));
    expect(screen.getByTestId('guessing-panel')).toBeInTheDocument();
    expect(screen.getByTestId('car-option-RED')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByTestId('car-option-YELLOW'));
    expect(screen.queryByTestId('round-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('guess-bar-car')).toHaveTextContent('เหลือง');
    expect(apiMock.submitGuess).not.toHaveBeenCalled();
  });

  it('keeps the guess bar when the confirm step is closed, without starting a race', async () => {
    mockMemberApi();
    renderWithProviders(<PlayPage />);

    fireEvent.click(screen.getByTestId('start-new-race'));
    await screen.findByTestId('round-modal');
    fireEvent.click(screen.getByTestId('car-option-RED'));
    fireEvent.click(screen.getByTestId('submit-guess'));

    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });

    expect(screen.queryByTestId('round-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('guess-bar-car')).toHaveTextContent('แดง');
    expect(screen.queryByTestId('start-new-race')).not.toBeInTheDocument();
    expect(apiMock.submitGuess).not.toHaveBeenCalled();
    expect(unlockAudio).not.toHaveBeenCalled();
  });

  it('locks the car in the guess bar once the guess is saved', async () => {
    mockMemberApi();
    apiMock.startRace.mockRejectedValueOnce(new Error('network down'));
    renderWithProviders(<PlayPage />);

    fireEvent.click(screen.getByTestId('start-new-race'));
    await screen.findByTestId('round-modal');
    fireEvent.click(screen.getByTestId('car-option-RED'));
    fireEvent.click(screen.getByTestId('submit-guess'));
    fireEvent.click(screen.getByTestId('begin-race'));
    await screen.findByTestId('play-error');

    // Close the failed confirm: the saved guess stays, and cannot be changed.
    fireEvent.click(screen.getByTestId('round-modal-close'));
    expect(screen.getByTestId('guess-bar-car')).toHaveTextContent('แดง');
    expect(screen.queryByTestId('change-car')).not.toBeInTheDocument();

    // Submitting again resumes the round without re-sending the guess.
    fireEvent.click(screen.getByTestId('submit-guess'));
    fireEvent.click(screen.getByTestId('begin-race'));
    await screen.findByTestId('guess-bar-waiting');
    expect(apiMock.submitGuess).toHaveBeenCalledTimes(1);
    expect(apiMock.startRace).toHaveBeenCalledTimes(2);
  });

  it('shows the start button, not a stale guess bar, after the result is closed', async () => {
    mockMemberApi();
    renderWithProviders(<PlayPage />);

    fireEvent.click(screen.getByTestId('start-new-race'));
    await screen.findByTestId('round-modal');
    fireEvent.click(screen.getByTestId('car-option-RED'));
    fireEvent.click(screen.getByTestId('submit-guess'));
    fireEvent.click(screen.getByTestId('begin-race'));
    await screen.findByTestId('guess-bar-waiting');
    fireEvent.click(screen.getByTestId('stub-finish'));
    await screen.findByTestId('result-panel');

    fireEvent.click(screen.getByTestId('result-modal-close'));
    expect(screen.getByTestId('start-new-race')).toBeInTheDocument();
    expect(screen.queryByTestId('guess-bar')).not.toBeInTheDocument();
  });
});

describe('PlayPage guest', () => {
  beforeEach(() => {
    resetMocks();
    authState.authEnabled = true;
    authState.user = null;
    authState.isAuthenticated = false;
    authState.initializing = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function expectNoApiCalls() {
    expect(apiMock.createRace).not.toHaveBeenCalled();
    expect(apiMock.submitGuess).not.toHaveBeenCalled();
    expect(apiMock.startRace).not.toHaveBeenCalled();
    expect(apiMock.settleRace).not.toHaveBeenCalled();
  }

  it('plays a full round through the dialog with no API call, no storage, and no points', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // guest winner → RED
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    renderWithProviders(<PlayPage />);
    expect(screen.getByTestId('guest-banner')).toHaveTextContent('Guest');

    fireEvent.click(screen.getByTestId('start-new-race'));
    expect(screen.getByTestId('round-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('submit-guess')).not.toBeInTheDocument();

    // Pick BLUE, change mind via back, then go with RED.
    fireEvent.click(screen.getByTestId('car-option-BLUE'));
    fireEvent.click(screen.getByTestId('submit-guess'));
    expect(screen.getByTestId('confirm-choice')).toHaveTextContent('น้ำเงิน');
    fireEvent.click(screen.getByTestId('round-back'));
    expect(screen.getByTestId('car-option-RED')).toBeEnabled();
    fireEvent.click(screen.getByTestId('car-option-RED'));
    fireEvent.click(screen.getByTestId('submit-guess'));
    expectNoRaceStartButton();

    fireEvent.click(screen.getByTestId('begin-race'));
    expect(unlockAudio).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('round-modal')).not.toBeInTheDocument();
    expect(screen.getByTestId('guess-bar-waiting')).toBeInTheDocument();
    expect(screen.getByTestId('guess-bar-car')).toHaveTextContent('แดง');
    expect(screen.getByTestId('stub-finish')).toHaveAttribute('data-winner', 'RED');

    fireEvent.click(screen.getByTestId('stub-finish'));
    expect(screen.getByTestId('result-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('guess-bar')).not.toBeInTheDocument();
    expect(screen.getByTestId('result-winner')).toHaveTextContent('แดง');
    expect(screen.getByTestId('result-outcome')).toHaveTextContent('ถูก');
    expect(screen.queryByTestId('result-points')).not.toBeInTheDocument();

    const invite = screen.getByTestId('guest-invite');
    expect(screen.getByTestId('guest-invite-register')).toHaveAttribute('href', '/register');
    expect(screen.getByTestId('guest-invite-login')).toHaveAttribute('href', '/login');
    expect(invite).toBeInTheDocument();

    expectNoApiCalls();
    expect(setItemSpy).not.toHaveBeenCalled();
  });

  it('starts the next guest round right away with car selection unlocked', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // guest winner → BLUE

    renderWithProviders(<PlayPage />);
    fireEvent.click(screen.getByTestId('start-new-race'));
    fireEvent.click(screen.getByTestId('car-option-RED'));
    fireEvent.click(screen.getByTestId('submit-guess'));
    fireEvent.click(screen.getByTestId('begin-race'));
    fireEvent.click(screen.getByTestId('stub-finish'));
    expect(screen.getByTestId('result-outcome')).toHaveTextContent('ผิด');

    fireEvent.click(screen.getByTestId('next-race'));
    expect(screen.getByTestId('guessing-panel')).toBeInTheDocument();
    expect(screen.getByTestId('car-option-BLUE')).toBeEnabled();
    expect(screen.queryByTestId('submit-guess')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guess-accepted')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('car-option-BLUE'));
    expect(screen.getByTestId('game-overlay')).toContainElement(screen.getByTestId('submit-guess'));
    expectNoApiCalls();
  });

  it('shows a loading state and no start button while the session is being verified', () => {
    authState.initializing = true;

    renderWithProviders(<PlayPage />);

    expect(screen.getByTestId('auth-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('start-new-race')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-banner')).not.toBeInTheDocument();
  });

  it('shows no register/login invite after a round when accounts are turned off', () => {
    authState.authEnabled = false;
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderWithProviders(<PlayPage />);
    fireEvent.click(screen.getByTestId('start-new-race'));
    fireEvent.click(screen.getByTestId('car-option-RED'));
    fireEvent.click(screen.getByTestId('submit-guess'));
    fireEvent.click(screen.getByTestId('begin-race'));
    fireEvent.click(screen.getByTestId('stub-finish'));

    expect(screen.getByTestId('result-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('guest-invite')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-invite-register')).not.toBeInTheDocument();
    expect(screen.queryByTestId('guest-invite-login')).not.toBeInTheDocument();
  });
});
