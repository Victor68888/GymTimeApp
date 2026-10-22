import { describe, expect, it } from '@jest/globals';
import { sceneFrame } from '../components/GymScene';

describe('sceneFrame', () => {
  it('stands on the start screen', () => {
    expect(sceneFrame('idle', false, false)).toBe('stand');
  });

  it('squats up and down while training', () => {
    expect(sceneFrame('training', false, false)).toBe('stand');
    expect(sceneFrame('training', true, false)).toBe('squat');
  });

  it('sits on the bench while resting and on the summary', () => {
    expect(sceneFrame('resting', true, false)).toBe('rest');
    expect(sceneFrame('summary', false, false)).toBe('rest');
  });

  it('holds the squat pose still when Reduce Motion is on', () => {
    expect(sceneFrame('training', false, true)).toBe('squat');
    expect(sceneFrame('training', true, true)).toBe('squat');
  });
});
