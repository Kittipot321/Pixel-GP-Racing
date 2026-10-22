// PlayPage — the gameplay screen, for logged-in players and guests.
//
// Both flows share one round dialog (RoundModal). "เริ่มเกม" (and
// "ลองอีกครั้ง" in the result dialog) opens it on the pick step. Choosing a
// car closes the dialog, and the guess panel (GuessBar) appears in the center
// of the track with the picked car, "เปลี่ยนรถ" (reopens the picker with
// the car still selected) and "ส่งคำทาย". "ส่งคำทาย" opens the dialog on the
// confirm step ("are you sure?"), which only changes the dialog and sends
// nothing; it is a small dialog that always opens centered on the track, on
// phones too (the pick step opens over the whole page there). "ย้อนกลับ"
// returns to the pick step. "ยืนยันคำตอบ" unlocks browser audio synchronously
// in the click, before any API call, then settles the round; on success the
// dialog closes and the race runs on the track, while a small bar in the
// track's top-left corner shows the submitted car with "รอผลการแข่ง…" until
// the result dialog opens. The dialog can be closed
// (close button or Esc) at any time except while a confirm request is running.
// Closing before a car is picked drops the round (the start button returns);
// closing after a pick keeps it, so the guess panel stays on the track.
// Both dialogs are passed as children of GameCanvas, so they open on top of
// the track and stay visible while the track is fullscreen.
//
// Logged-in flow: opening the dialog creates an OPEN race. Confirm then calls
// submit guess → start (OPEN → RUNNING) → settle, in that order, to obtain the
// SERVER's authoritative winner + points. Progress is kept per race, so if a
// step fails the dialog stays open with the error and confirming again
// resumes from the failed step without repeating the ones that succeeded.
// Once the guess is saved, "ย้อนกลับ" and the car choice are disabled so the
// car shown always matches the saved guess. The animation runs toward the
// server's winner, then the result dialog (ResultModal) opens. Settlement
// is idempotent and the client never computes the score.
//
// Guest flow: the same dialog, but the round lives only in component state.
// The winner is picked in the browser (settleGuestRound), no API call is made,
// nothing is written to storage, and no points are shown. The result dialog
// invites the guest to register or log in to keep score.

import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CAR_COLORS, type CarColor, type Race, type SettleResult } from '@pixel-race/shared-types';
import { api, ApiRequestError } from '../../services/api.ts';
import { CAR_CSS } from '../../game/colors.ts';
import { GameCanvas, type GameCanvasHandle } from '../../game/GameCanvas.tsx';
import { useAuth } from '../auth/auth-context.tsx';
import { settleGuestRound, type GuestResult } from './guest-round.ts';
import { Modal } from '../../app/Modal.tsx';
import {
  errorText,
  pixelButtonCompact,
  pixelButtonCompactPrimary,
  pixelButtonPrimary,
  pixelLink,
} from '../../app/ui.ts';
import { useI18n } from '../../i18n/i18n-context.tsx';
import { useCanonicalPath, useDocumentTitle } from '../../app/use-document-title.ts';

type Phase = 'idle' | 'running' | 'settled';
type RoundStep = 'pick' | 'confirm';

const carButton =
  'aspect-[3/2] min-h-11 cursor-pointer border-4 font-pixel text-xs text-on-accent shadow-[4px_4px_0_0_#000] focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60';

export function PlayPage() {
  const { isAuthenticated, initializing } = useAuth();
  const { t } = useI18n();
  useDocumentTitle(t.nav.play);
  useCanonicalPath('/play');

  if (initializing) {
    return (
      <p data-testid="auth-loading" className="p-6 text-center font-pixel text-xs text-muted">
        {t.common.authChecking}
      </p>
    );
  }
  return isAuthenticated ? <MemberPlay /> : <GuestPlay />;
}

// --- Shared pieces ---------------------------------------------------------

function CarPicker(props: {
  selected: CarColor | null;
  locked: boolean;
  onSelect: (color: CarColor) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="car-selection">
      {CAR_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          className={`${carButton} ${props.selected === color ? 'border-snow ring-4 ring-accent' : 'border-black'}`}
          style={{ backgroundColor: CAR_CSS[color] }}
          onClick={() => props.onSelect(color)}
          aria-pressed={props.selected === color}
          disabled={props.locked}
          data-testid={`car-option-${color}`}
        >
          {t.cars[color]}
        </button>
      ))}
    </div>
  );
}

/**
 * "เริ่มรอบใหม่", shown centered on the track. The page only passes it to the
 * canvas while idle with the round dialog closed, so it disappears as soon as
 * a round starts and stays hidden during the race.
 */
function NewRoundButton(props: { onClick: () => void; pending?: boolean }) {
  const { t } = useI18n();
  const pending = props.pending ?? false;
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={pending}
      className={`${pixelButtonPrimary} sm:px-6 sm:py-3 sm:text-sm`}
      data-testid="start-new-race"
    >
      {pending ? t.play.creatingRound : t.play.startGame}
    </button>
  );
}

/** Color swatch plus the car's name. */
function CarLabel({ color }: { color: CarColor }) {
  const { t } = useI18n();
  return (
    <>
      <span
        aria-hidden="true"
        className="inline-block h-3 w-3 border-2 border-black sm:h-4 sm:w-4"
        style={{ backgroundColor: CAR_CSS[color] }}
      />
      <strong data-testid="guess-bar-car">{t.cars[color]}</strong>
    </>
  );
}

/**
 * The picked car on the track.
 *
 * Before submitting it is a card in the center of the track (the canvas
 * overlay) with "เปลี่ยนรถ" and "ส่งคำทาย" ("ส่งคำทาย" opens the confirm step;
 * once the guess is saved (member retry) the car can no longer change). With
 * `waiting` the guess is submitted and the race is running: a small strip in
 * the track's top-left corner shows the car and "รอผลการแข่ง…" with no buttons,
 * so the middle of the track stays clear for the race.
 */
function GuessBar(props: {
  selected: CarColor;
  waiting?: boolean;
  locked?: boolean;
  onChange?: () => void;
  onSubmit?: () => void;
}) {
  const { t } = useI18n();

  if (props.waiting) {
    return (
      <div
        className="flex flex-wrap items-center gap-1 border-2 border-black bg-panel/90 p-1 text-snow shadow-[2px_2px_0_0_#000] sm:gap-2 sm:border-4 sm:p-2 sm:shadow-[4px_4px_0_0_#000]"
        data-testid="guess-bar"
      >
        <span className="flex items-center gap-1 font-pixel text-[0.55rem] leading-relaxed sm:gap-2 sm:text-[0.65rem]">
          <span className="hidden sm:inline">{t.play.yourGuess}</span>
          <CarLabel color={props.selected} />
        </span>
        <span
          role="status"
          aria-live="polite"
          className="animate-pulse font-pixel text-[0.55rem] leading-relaxed text-accent-text sm:text-[0.65rem]"
          data-testid="guess-bar-waiting"
        >
          {t.play.waitingResult}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col items-center gap-2 border-2 border-black bg-panel/95 p-2 text-snow shadow-[3px_3px_0_0_#000] sm:gap-3 sm:border-4 sm:p-4 sm:shadow-[6px_6px_0_0_#000]"
      data-testid="guess-bar"
    >
      <span className="flex items-center gap-2 font-pixel text-[0.6rem] leading-relaxed sm:text-xs">
        <span>{t.play.selectedCar}</span>
        <CarLabel color={props.selected} />
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {!props.locked && (
          <button
            type="button"
            onClick={props.onChange}
            className={pixelButtonCompact}
            data-testid="change-car"
          >
            {t.play.changeCar}
          </button>
        )}
        <button
          type="button"
          onClick={props.onSubmit}
          className={pixelButtonCompactPrimary}
          data-testid="submit-guess"
        >
          {t.play.submitGuess}
        </button>
      </div>
    </div>
  );
}

// function RunningStatus() {
//   const { t } = useI18n();
//   return (
//     <p className="animate-pulse font-pixel text-xs text-accent" data-testid="running-status">
//       {t.play.racing}
//     </p>
//   );
// }

/**
 * Result dialog shown when the race animation finishes. Closing it (close
 * button or Esc) returns the page to idle so "เริ่มรอบใหม่" is available;
 * "ลองอีกครั้ง" starts the next round straight away.
 */
function ResultModal(props: {
  open: boolean;
  winnerColor: CarColor;
  isCorrect: boolean;
  /** Creating the next round is in progress: the dialog is held open. */
  nextPending?: boolean;
  error?: string | null;
  onNext: () => void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const pending = props.nextPending ?? false;
  return (
    <Modal
      open={props.open}
      title={t.play.resultTitle}
      onClose={props.onClose}
      canClose={!pending}
      testId="result-modal"
    >
      <div className="flex flex-col gap-3" data-testid="result-panel">
        <p data-testid="result-winner">
          {t.play.winner} <strong>{t.cars[props.winnerColor]}</strong>
        </p>
        <p data-testid="result-outcome">
          {props.isCorrect ? t.play.guessedRight : t.play.guessedWrong}
        </p>
        {props.children}
        <button
          type="button"
          onClick={props.onNext}
          disabled={pending}
          className={`${pixelButtonPrimary} self-start`}
          data-autofocus
          data-testid="next-race"
        >
          {pending ? t.play.creatingRound : t.play.tryAgain}
        </button>
      </div>
      <PlayError message={props.error ?? null} />
    </Modal>
  );
}

function PlayError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <p className={errorText} role="alert" data-testid="play-error">
      {message}
    </p>
  );
}

/** Open/step/selection state of the round dialog, shared by both flows. */
function useRoundDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<RoundStep>('pick');
  const [selected, setSelected] = useState<CarColor | null>(null);
  return {
    open,
    step,
    selected,
    /** Pick a car: the dialog closes and the guess bar takes over. */
    select: (color: CarColor) => {
      setSelected(color);
      setStep('pick');
      setOpen(false);
    },
    openNew: () => {
      setSelected(null);
      setStep('pick');
      setOpen(true);
    },
    /** Reopen the picker, keeping the current car selected. */
    reopenPick: () => {
      setStep('pick');
      setOpen(true);
    },
    /** Open the dialog on the confirm step for the picked car. */
    openConfirm: () => {
      setStep('confirm');
      setOpen(true);
    },
    back: () => setStep('pick'),
    close: () => setOpen(false),
    /** The round is confirmed: close and forget the pick, so no guess bar lingers. */
    finish: () => {
      setOpen(false);
      setSelected(null);
      setStep('pick');
    },
  };
}

type RoundDialog = ReturnType<typeof useRoundDialog>;

function RoundModal(props: {
  dialog: RoundDialog;
  /** A confirm request is running: everything is held. */
  pending: boolean;
  /** The guess is already saved: the car can no longer change. */
  guessLocked: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { dialog, pending, guessLocked } = props;
  const { selected } = dialog;
  const { t } = useI18n();

  return (
    <Modal
      open={dialog.open}
      title={dialog.step === 'pick' ? t.play.pickTitle : t.play.confirmTitle}
      onClose={props.onClose}
      canClose={!pending}
      focusKey={dialog.step}
      testId="round-modal"
      stayInHost={dialog.step === 'confirm'}
      compact={dialog.step === 'confirm'}
    >
      {dialog.step === 'pick' ? (
        <div className="flex flex-col gap-3" data-testid="guessing-panel">
          <p>{t.play.pickPrompt}</p>
          <CarPicker selected={selected} locked={guessLocked} onSelect={dialog.select} />
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:gap-3" data-testid="guess-accepted">
          <p data-testid="confirm-choice">
            {t.play.yourGuess} <strong>{selected ? t.cars[selected] : '-'}</strong>
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={dialog.back}
              disabled={pending || guessLocked}
              className={pixelButtonCompact}
              data-testid="round-back"
            >
              {t.play.back}
            </button>
            <button
              type="button"
              onClick={props.onConfirm}
              disabled={pending || !selected}
              className={pixelButtonCompactPrimary}
              data-autofocus
              data-testid="begin-race"
            >
              {pending ? t.play.confirming : t.play.confirm}
            </button>
          </div>
        </div>
      )}
      <PlayError message={props.error} />
    </Modal>
  );
}

// --- Logged-in player (server-authoritative) --------------------------------

/** What already succeeded for one race, so a retry resumes from the failed step. */
interface ConfirmProgress {
  raceId: string | null;
  guessSaved: boolean;
  started: boolean;
  settled: SettleResult | null;
}

const NO_PROGRESS: ConfirmProgress = {
  raceId: null,
  guessSaved: false,
  started: false,
  settled: null,
};

function MemberPlay() {
  const { logout } = useAuth();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const canvasRef = useRef<GameCanvasHandle | null>(null);
  const dialog = useRoundDialog();
  const progress = useRef<ConfirmProgress>({ ...NO_PROGRESS });
  const [race, setRace] = useState<Race | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [guessSaved, setGuessSaved] = useState(false);
  const [result, setResult] = useState<SettleResult | null>(null);
  /** The car submitted for the running race, shown while waiting for the result. */
  const [submitted, setSubmitted] = useState<CarColor | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleError(err: unknown, fallback: string) {
    if (err instanceof ApiRequestError && err.isAuthError) {
      logout();
      return;
    }
    setError(err instanceof ApiRequestError ? t.apiMessage(err.message) : fallback);
  }

  const createRace = useMutation({
    mutationFn: () => api.createRace(),
    onSuccess: (newRace) => {
      progress.current = { ...NO_PROGRESS, raceId: newRace.id };
      setRace(newRace);
      setGuessSaved(false);
      setError(null);
      setPhase('idle'); // closes the result dialog, if open
      dialog.openNew();
    },
    onError: (err) => handleError(err, t.play.createFailed),
  });

  // Confirm: guess → start → settle, skipping steps that already succeeded.
  const confirmRound = useMutation({
    mutationFn: async (input: { raceId: string; color: CarColor }): Promise<SettleResult> => {
      const done = progress.current;
      if (done.raceId !== input.raceId) {
        throw new Error(t.play.raceMismatch);
      }
      if (!done.guessSaved) {
        await api.submitGuess(input.raceId, input.color);
        done.guessSaved = true;
        setGuessSaved(true);
      }
      if (!done.started) {
        await api.startRace(input.raceId);
        done.started = true;
      }
      if (!done.settled) {
        done.settled = await api.settleRace(input.raceId);
      }
      return done.settled;
    },
    onSuccess: (settled, input) => {
      setResult(settled);
      setSubmitted(input.color);
      dialog.finish();
      setPhase('running');
    },
    onError: (err) => handleError(err, t.play.confirmFailed),
  });

  function confirm() {
    if (!race || !dialog.selected) {
      return;
    }
    // Must run synchronously in this click, before any awaited API call.
    canvasRef.current?.unlockAudio();
    setError(null);
    confirmRound.mutate({ raceId: race.id, color: dialog.selected });
  }

  function closeRound() {
    // Without a pick the OPEN race is dropped (a new round creates a new race);
    // with a pick the guess bar keeps the round on the track.
    dialog.close();
    setError(null);
  }

  function newRound() {
    setError(null);
    setSubmitted(null);
    confirmRound.reset();
    createRace.mutate();
  }

  function onRaceFinished() {
    setPhase('settled');
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
    void queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
  }

  function closeResult() {
    setError(null);
    setPhase('idle');
  }

  const resultOpen = phase === 'settled' && result !== null;
  // A car is picked and the round waits on the track for "ส่งคำทาย".
  const waitingToSubmit = phase === 'idle' && !dialog.open && race !== null && !!dialog.selected;

  return (
    <section className="flex flex-col gap-4" data-testid="play-page">
      <GameCanvas
        ref={canvasRef}
        winnerColor={phase === 'running' ? (result?.winnerColor ?? null) : null}
        raceId={race?.id ?? null}
        onRaceFinished={onRaceFinished}
        overlay={
          waitingToSubmit && dialog.selected ? (
            <GuessBar
              selected={dialog.selected}
              locked={guessSaved}
              onChange={dialog.reopenPick}
              onSubmit={dialog.openConfirm}
            />
          ) : phase === 'idle' && !dialog.open ? (
            <NewRoundButton onClick={newRound} pending={createRace.isPending} />
          ) : null
        }
        topLeft={
          phase === 'running' && submitted ? <GuessBar selected={submitted} waiting /> : null
        }
      >
        {/* Children of the canvas: the dialogs open on the track, also in fullscreen. */}
        {result && (
          <ResultModal
            open={resultOpen}
            winnerColor={result.winnerColor}
            isCorrect={result.isCorrect}
            nextPending={createRace.isPending}
            error={resultOpen ? error : null}
            onNext={newRound}
            onClose={closeResult}
          >
            {/* <p data-testid="result-points">คะแนนที่ได้: {result.pointsAwarded}</p> */}
          </ResultModal>
        )}

        <RoundModal
          dialog={dialog}
          pending={confirmRound.isPending}
          guessLocked={guessSaved}
          error={dialog.open ? error : null}
          onConfirm={confirm}
          onClose={closeRound}
        />
      </GameCanvas>

      {!dialog.open && !resultOpen && <PlayError message={error} />}

      {/* {phase === 'running' && <RunningStatus />} */}
    </section>
  );
}

// --- Guest (browser-only, nothing saved) -----------------------------------

function GuestPlay() {
  const { authEnabled } = useAuth();
  const { t } = useI18n();
  const canvasRef = useRef<GameCanvasHandle | null>(null);
  const dialog = useRoundDialog();
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<GuestResult | null>(null);
  /** The car submitted for the running race, shown while waiting for the result. */
  const [submitted, setSubmitted] = useState<CarColor | null>(null);
  const [error, setError] = useState<string | null>(null);

  const raceId = round > 0 ? `guest-${round}` : null;
  // A car is picked and the round waits on the track for "ส่งคำทาย".
  const waitingToSubmit = phase === 'idle' && !dialog.open && raceId !== null && !!dialog.selected;

  function newRound() {
    setRound((n) => n + 1);
    setError(null);
    setSubmitted(null);
    setPhase('idle'); // closes the result dialog, if open
    dialog.openNew();
  }

  function confirm() {
    const color = dialog.selected;
    if (!color) {
      return;
    }
    canvasRef.current?.unlockAudio();
    try {
      setResult(settleGuestRound(color));
      setSubmitted(color);
      setError(null);
      dialog.finish();
      setPhase('running');
    } catch (err) {
      console.error('Guest round could not be settled', err);
      setError(t.play.confirmFailedRetry);
    }
  }

  function closeRound() {
    dialog.close();
    setError(null);
  }

  return (
    <section className="flex flex-col gap-0" data-testid="play-page">
      <p className="p-3 text-sm text-muted text-center" data-testid="guest-banner">
        {authEnabled ? t.play.guestBanner : t.play.guestModeBanner}
      </p>

      <GameCanvas
        ref={canvasRef}
        winnerColor={phase === 'running' ? (result?.winnerColor ?? null) : null}
        raceId={raceId}
        onRaceFinished={() => setPhase('settled')}
        overlay={
          waitingToSubmit && dialog.selected ? (
            <GuessBar
              selected={dialog.selected}
              onChange={dialog.reopenPick}
              onSubmit={dialog.openConfirm}
            />
          ) : phase === 'idle' && !dialog.open ? (
            <NewRoundButton onClick={newRound} />
          ) : null
        }
        topLeft={
          phase === 'running' && submitted ? <GuessBar selected={submitted} waiting /> : null
        }
      >
        {/* Children of the canvas: the dialogs open on the track, also in fullscreen. */}
        {result && (
          <ResultModal
            open={phase === 'settled'}
            winnerColor={result.winnerColor}
            isCorrect={result.isCorrect}
            onNext={newRound}
            onClose={() => setPhase('idle')}
          >
            {/* No account invite when accounts are turned off. */}
            {authEnabled && (
              <p className="text-sm text-muted" data-testid="guest-invite">
                {t.play.guestInvite}{' '}
                <Link to="/register" className={pixelLink} data-testid="guest-invite-register">
                  {t.common.register}
                </Link>{' '}
                {t.common.or}{' '}
                <Link to="/login" className={pixelLink} data-testid="guest-invite-login">
                  {t.common.login}
                </Link>
              </p>
            )}
          </ResultModal>
        )}

        <RoundModal
          dialog={dialog}
          pending={false}
          guessLocked={false}
          error={error}
          onConfirm={confirm}
          onClose={closeRound}
        />
      </GameCanvas>

      {/* {phase === 'running' && <RunningStatus />} */}
    </section>
  );
}
