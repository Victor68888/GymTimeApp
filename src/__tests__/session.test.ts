import { describe, expect, it } from '@jest/globals';
import {
  formatDuration,
  getTotals,
  initialSession,
  sessionReducer,
  SessionAction,
  SessionState,
} from '../session';

const SEC = 1000;
const MIN = 60 * SEC;
const T0 = 1_700_000_000_000; // fixed start time so tests are repeatable

/** Runs a list of actions from the idle state. */
function run(actions: SessionAction[]): SessionState {
  return actions.reduce(sessionReducer, initialSession);
}

describe('sessionReducer', () => {
  it('starts idle with zero on every clock', () => {
    expect(initialSession.phase).toBe('idle');
    expect(getTotals(initialSession, T0)).toEqual({
      trainingMs: 0,
      currentRestMs: 0,
      totalRestMs: 0,
    });
  });

  it('BEGIN starts the training timer', () => {
    const s = run([{ type: 'BEGIN', now: T0 }]);
    expect(s.phase).toBe('training');
    expect(getTotals(s, T0 + 28 * SEC).trainingMs).toBe(28 * SEC);
    expect(getTotals(s, T0 + 28 * SEC).currentRestMs).toBe(0);
  });

  it('training keeps counting while resting', () => {
    const s = run([
      { type: 'BEGIN', now: T0 },
      { type: 'REST', now: T0 + 2 * MIN },
    ]);
    expect(s.phase).toBe('resting');
    const t = getTotals(s, T0 + 2 * MIN + 45 * SEC);
    expect(t.trainingMs).toBe(2 * MIN + 45 * SEC); // did not pause
    expect(t.currentRestMs).toBe(45 * SEC);
  });

  it('RESUME records the rest and the next rest starts from 0', () => {
    const s = run([
      { type: 'BEGIN', now: T0 },
      { type: 'REST', now: T0 + 2 * MIN },
      { type: 'RESUME', now: T0 + 3 * MIN + 30 * SEC },
    ]);
    expect(s.phase).toBe('training');
    expect(s.rests).toEqual([90 * SEC]);
    expect(getTotals(s, T0 + 4 * MIN).currentRestMs).toBe(0);

    const again = sessionReducer(s, { type: 'REST', now: T0 + 5 * MIN });
    const t = getTotals(again, T0 + 5 * MIN + 10 * SEC);
    expect(t.currentRestMs).toBe(10 * SEC); // fresh rest clock
    expect(t.totalRestMs).toBe(90 * SEC + 10 * SEC);
  });

  it('FINISH freezes the summary: training, total rest and each rest', () => {
    const s = run([
      { type: 'BEGIN', now: T0 },
      { type: 'REST', now: T0 + 2 * MIN },
      { type: 'RESUME', now: T0 + 3 * MIN },
      { type: 'REST', now: T0 + 5 * MIN },
      { type: 'RESUME', now: T0 + 6 * MIN + 45 * SEC },
      { type: 'FINISH', now: T0 + 8 * MIN },
    ]);
    expect(s.phase).toBe('summary');
    expect(s.rests).toEqual([1 * MIN, 1 * MIN + 45 * SEC]);
    // Same numbers no matter how much later we look.
    expect(getTotals(s, T0 + 60 * MIN)).toEqual({
      trainingMs: 8 * MIN,
      currentRestMs: 0,
      totalRestMs: 2 * MIN + 45 * SEC,
    });
  });

  it('FINISH while resting records the last rest', () => {
    const s = run([
      { type: 'BEGIN', now: T0 },
      { type: 'REST', now: T0 + 1 * MIN },
      { type: 'FINISH', now: T0 + 3 * MIN },
    ]);
    expect(s.rests).toEqual([2 * MIN]);
    expect(getTotals(s, T0 + 3 * MIN)).toEqual({
      trainingMs: 3 * MIN,
      currentRestMs: 0,
      totalRestMs: 2 * MIN,
    });
  });

  it('the listed rests always add up to the total rest shown', () => {
    // 2.7 s and 2.6 s rests show as 00:02 and 00:02, so the total must be 00:04.
    const s = run([
      { type: 'BEGIN', now: T0 },
      { type: 'REST', now: T0 + 1000 },
      { type: 'RESUME', now: T0 + 3700 },
      { type: 'REST', now: T0 + 5000 },
      { type: 'FINISH', now: T0 + 7600 },
    ]);
    expect(s.rests.map(formatDuration)).toEqual(['00:02', '00:02']);
    expect(formatDuration(getTotals(s, T0 + 7600).totalRestMs)).toBe('00:04');
  });

  it('ignores buttons that do not apply to the current screen', () => {
    const idle = initialSession;
    expect(sessionReducer(idle, { type: 'REST', now: T0 })).toBe(idle);
    expect(sessionReducer(idle, { type: 'FINISH', now: T0 })).toBe(idle);

    const training = run([{ type: 'BEGIN', now: T0 }]);
    expect(sessionReducer(training, { type: 'BEGIN', now: T0 + 5 })).toBe(training);
    expect(sessionReducer(training, { type: 'RESUME', now: T0 + 5 })).toBe(training);

    const resting = sessionReducer(training, { type: 'REST', now: T0 + 10 });
    expect(sessionReducer(resting, { type: 'REST', now: T0 + 20 })).toBe(resting);
  });

  it('never goes negative if the clock jumps backwards', () => {
    const s = run([{ type: 'BEGIN', now: T0 }]);
    expect(getTotals(s, T0 - 5 * SEC).trainingMs).toBe(0);
    const rested = run([
      { type: 'BEGIN', now: T0 },
      { type: 'REST', now: T0 + 10 * SEC },
      { type: 'RESUME', now: T0 + 5 * SEC },
    ]);
    expect(rested.rests).toEqual([0]);
  });

  it('RESET returns to the start screen and clears the rests', () => {
    const s = run([
      { type: 'BEGIN', now: T0 },
      { type: 'REST', now: T0 + MIN },
      { type: 'FINISH', now: T0 + 2 * MIN },
      { type: 'RESET' },
    ]);
    expect(s).toEqual(initialSession);
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '00:00'],
    [999, '00:00'],
    [28 * SEC, '00:28'],
    [59.9 * SEC, '00:59'],
    [61 * SEC, '01:01'],
    [59 * MIN + 59 * SEC, '59:59'],
    [60 * MIN, '1:00:00'],
    [75 * MIN + 5 * SEC, '1:15:05'],
    [-5 * SEC, '00:00'],
  ])('%d ms -> %s', (ms, expected) => {
    expect(formatDuration(ms)).toBe(expected);
  });
});
