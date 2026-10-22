/**
 * Session timer logic for Gym Time.
 *
 * The session is a small state machine:
 *
 *   idle --BEGIN--> training --REST--> resting --RESUME--> training ...
 *                       \                  /
 *                        ---- FINISH ----> summary --NEW SESSION--> idle
 *
 * Rules:
 * - TRAINING counts from BEGIN to FINISH without stopping, rests included.
 * - REST counts only the current rest. On RESUME that rest's length is
 *   recorded and the rest clock starts again from 0 next time.
 * - FINISH during a rest records that last rest too.
 *
 * Time is never counted tick by tick. Every transition stores a timestamp and
 * the numbers are calculated from timestamps, so they stay correct even if the
 * UI lags, the phone stutters, or the app is briefly in the background.
 */

export type Phase = 'idle' | 'training' | 'resting' | 'summary';

export interface SessionState {
  phase: Phase;
  /** When BEGIN was tapped (ms since epoch). */
  startedAt: number | null;
  /** When FINISH was confirmed. */
  endedAt: number | null;
  /** When the current rest started; null when not resting. */
  restStartedAt: number | null;
  /** Length of each finished rest, in order (Rest 1, Rest 2, ...). Whole seconds. */
  rests: number[];
}

export const initialSession: SessionState = {
  phase: 'idle',
  startedAt: null,
  endedAt: null,
  restStartedAt: null,
  rests: [],
};

export type SessionAction =
  | { type: 'BEGIN'; now: number }
  | { type: 'REST'; now: number }
  | { type: 'RESUME'; now: number }
  | { type: 'FINISH'; now: number }
  | { type: 'RESET' };

/** Drops partial seconds, e.g. 2,700 ms -> 2,000 ms. */
const wholeSeconds = (ms: number) => Math.floor(ms / 1000) * 1000;

/** Time from `from` to `to`, never negative (guards against clock changes). */
const since = (from: number | null, to: number) =>
  from === null ? 0 : Math.max(0, to - from);

/** Records the rest that is running now and clears the rest clock. */
function recordRest(state: SessionState, now: number): SessionState {
  if (state.restStartedAt === null) return state;
  return {
    ...state,
    rests: [...state.rests, wholeSeconds(since(state.restStartedAt, now))],
    restStartedAt: null,
  };
}

export function sessionReducer(
  state: SessionState,
  action: SessionAction,
): SessionState {
  switch (action.type) {
    case 'BEGIN':
      if (state.phase !== 'idle') return state;
      return { ...initialSession, phase: 'training', startedAt: action.now };

    case 'REST':
      if (state.phase !== 'training') return state;
      return { ...state, phase: 'resting', restStartedAt: action.now };

    case 'RESUME':
      if (state.phase !== 'resting') return state;
      return { ...recordRest(state, action.now), phase: 'training' };

    case 'FINISH':
      if (state.phase !== 'training' && state.phase !== 'resting') return state;
      return { ...recordRest(state, action.now), phase: 'summary', endedAt: action.now };

    case 'RESET':
      return initialSession;

    default:
      return state;
  }
}

export interface SessionTotals {
  /** Whole session, BEGIN to now (or to FINISH). Never pauses. */
  trainingMs: number;
  /** The rest running right now; 0 when not resting. */
  currentRestMs: number;
  /** All rests added up, including the one running now. */
  totalRestMs: number;
}

/** Live numbers at `now`. After FINISH, pass `endedAt` (or any later time). */
export function getTotals(state: SessionState, now: number): SessionTotals {
  const end = state.endedAt ?? now;
  const trainingMs = wholeSeconds(since(state.startedAt, end));
  const currentRestMs = wholeSeconds(since(state.restStartedAt, now));
  const recorded = state.rests.reduce((sum, ms) => sum + ms, 0);
  return { trainingMs, currentRestMs, totalRestMs: recorded + currentRestMs };
}

/**
 * Formats a duration as a clock: "mm:ss" under an hour, "h:mm:ss" from an hour.
 * Partial seconds are dropped, so 59.9 s shows as 00:59.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
