import { useEffect, useState } from 'react';
import { AccessibilityInfo, Image, StyleSheet, View } from 'react-native';
import type { Phase } from '../session';

const frames = {
  stand: require('../../assets/gym-stand.jpg'),
  squat: require('../../assets/gym-squat.jpg'),
  rest: require('../../assets/gym-rest.jpg'),
};
export type Frame = keyof typeof frames;

/**
 * Which picture to show. `down` flips every SQUAT_FRAME_MS while training.
 * With Reduce Motion on, training shows the squat pose without moving.
 */
export function sceneFrame(phase: Phase, down: boolean, reduceMotion: boolean): Frame {
  if (phase === 'resting' || phase === 'summary') return 'rest';
  if (phase === 'training') return reduceMotion || down ? 'squat' : 'stand';
  return 'stand';
}

/** How long each squat pose (standing, then down) stays on screen. */
export const SQUAT_FRAME_MS = 900;

/**
 * The pixel-art lifter in the middle of the screen.
 * - Start screen: standing with the bar.
 * - Training: squats up and down, one pose every SQUAT_FRAME_MS.
 * - Resting and summary: sits on the bench.
 *
 * All three pictures stay loaded and only the visible one changes, so
 * switching poses never flickers while an image loads.
 */
export function GymScene({ phase }: { phase: Phase }) {
  const [down, setDown] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Respect the phone's "Reduce Motion" setting: no squat animation then.
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduceMotion(on))
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const animate = phase === 'training' && !reduceMotion;

  useEffect(() => {
    if (!animate) return;
    const id = setInterval(() => setDown((d) => !d), SQUAT_FRAME_MS);
    return () => {
      clearInterval(id);
      setDown(false); // next set starts from standing
    };
  }, [animate]);

  const visible = sceneFrame(phase, down, reduceMotion);

  return (
    <View style={StyleSheet.absoluteFill} testID={`scene-${visible}`}>
      {(Object.keys(frames) as Frame[]).map((name) => (
        <Image
          key={name}
          source={frames[name]}
          style={[StyleSheet.absoluteFill, styles.image, { opacity: name === visible ? 1 : 0 }]}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
