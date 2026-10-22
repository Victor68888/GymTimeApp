import { useEffect, useReducer, useRef, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';

import { GymScene } from './components/GymScene';
import { PixelButton, palettes } from './components/PixelButton';
import { TimerCard } from './components/TimerCard';
import {
  formatDuration,
  getTotals,
  initialSession,
  sessionReducer,
} from './session';
import { colors, pixelFont } from './theme';

/** Rests per summary column; two columns show 20 rests without scrolling. */
const RESTS_PER_COLUMN = 10;

/** Splits rests into columns of 10: [1-10], [11-20], [21-30], ... */
function restColumns(rests: number[]): { ms: number; n: number }[][] {
  const columns: { ms: number; n: number }[][] = [];
  rests.forEach((ms, i) => {
    const c = Math.floor(i / RESTS_PER_COLUMN);
    (columns[c] ??= []).push({ ms, n: i + 1 });
  });
  return columns;
}

/** How long FINISH waits for the confirming second tap. */
const FINISH_CONFIRM_MS = 3000;

function buzz(kind: 'tap' | 'done') {
  if (Platform.OS === 'web') return;
  const p =
    kind === 'done'
      ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  p.catch(() => {});
}

/** Keeps the screen on while mounted, so the clocks stay visible mid-set. */
function StayAwake() {
  useKeepAwake(undefined, { suppressDeactivateWarnings: true });
  return null;
}

/**
 * The whole MVP is this one screen. It changes with each button:
 * start (BEGIN) -> training (REST) <-> resting (RESUME) -> summary.
 */
export function GymTimeScreen() {
  const [session, dispatch] = useReducer(sessionReducer, initialSession);
  const [now, setNow] = useState(() => Date.now());
  const [finishArmed, setFinishArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const compact = height < 700;

  const active = session.phase === 'training' || session.phase === 'resting';

  // Refresh the clocks while a session runs. The numbers come from
  // timestamps, so the interval only decides how often the screen redraws.
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [active]);

  useEffect(
    () => () => {
      if (armTimer.current) clearTimeout(armTimer.current);
    },
    [],
  );

  const totals = getTotals(session, session.phase === 'summary' ? session.endedAt! : now);

  const disarmFinish = () => {
    if (armTimer.current) clearTimeout(armTimer.current);
    setFinishArmed(false);
  };

  /** Every screen change goes through here: one timestamp for the clock and the redraw. */
  const act = (type: 'BEGIN' | 'REST' | 'RESUME' | 'FINISH') => {
    const t = Date.now();
    disarmFinish();
    buzz(type === 'FINISH' ? 'done' : 'tap');
    setNow(t);
    dispatch({ type, now: t });
  };

  const finish = () => {
    if (finishArmed) {
      act('FINISH');
      return;
    }
    // First tap only arms the button, so a stray tap can't end the session.
    buzz('tap');
    setFinishArmed(true);
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setFinishArmed(false), FINISH_CONFIRM_MS);
  };

  const newSession = () => {
    buzz('tap');
    dispatch({ type: 'RESET' });
  };

  const side = 18;
  const gap = 14;
  const cardWidth = Math.min(220, (width - side * 2 - gap) / 2);
  const bigButtonHeight = compact ? 110 : 140;
  // Two rest columns side by side on the summary (1-10 | 11-20); 21+ wrap below.
  const restColumnWidth = Math.min(170, (width - side * 2 - gap) / 2);
  // FINISH gets 1 part of the row, REST 2.3 parts. Fit "FINISH" (6 pixel-font
  // characters) inside its button: width minus outline and padding.
  const finishWidth = (width - side * 2 - gap) / 3.3;
  const finishFont = Math.max(10, Math.min(16, Math.floor((finishWidth - 24) / 6.4)));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {active && <StayAwake />}

      {/* ---------- Top: title, or the two clocks ---------- */}
      <View style={[styles.header, { paddingHorizontal: side }]}>
        {session.phase === 'idle' && (
          <View style={[styles.hero, compact && { paddingTop: 24, paddingBottom: 18 }]}>
            <Text style={[styles.title, compact && { fontSize: 48 }]}>Gym Time</Text>
            <Text style={styles.subtitle}>Press begin and start your session</Text>
          </View>
        )}

        {active && (
          <>
            <Text style={styles.titleSmall}>Gym Time</Text>
            <View style={[styles.cards, { gap }]}>
              <TimerCard
                title="TRAINING"
                ms={totals.trainingMs}
                active
                variant="training"
                width={cardWidth}
              />
              <TimerCard
                title="REST"
                ms={totals.currentRestMs}
                active={session.phase === 'resting'}
                variant="rest"
                width={cardWidth}
              />
            </View>
          </>
        )}

        {session.phase === 'summary' && (
          <>
            <Text style={styles.titleSmall}>Session done</Text>
            <View style={[styles.cards, { gap }]}>
              <TimerCard
                title="TRAINING"
                ms={totals.trainingMs}
                active
                variant="training"
                width={cardWidth}
              />
              <TimerCard
                title="TOTAL REST"
                ms={totals.totalRestMs}
                active
                variant="rest"
                width={cardWidth}
              />
            </View>
            {session.rests.length === 0 ? (
              <Text style={[styles.summaryText, styles.noRests]}>NO RESTS</Text>
            ) : (
              <ScrollView
                style={styles.restList}
                contentContainerStyle={styles.restListContent}
                accessibilityLabel="Each rest"
              >
                {restColumns(session.rests).map((column, c) => (
                  <View key={c} style={[styles.restColumn, { width: restColumnWidth }]}>
                    {column.map(({ ms, n }) => (
                      <View key={n} style={styles.restRow}>
                        <Text style={styles.restText}>REST {n}</Text>
                        <Text style={styles.restText}>{formatDuration(ms)}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </ScrollView>
            )}
          </>
        )}
      </View>

      {/* ---------- Middle: the gym scene ---------- */}
      <View
        style={[styles.sceneBox, session.phase === 'summary' && styles.sceneBoxSummary]}
      >
        <GymScene phase={session.phase} />
        {session.phase === 'resting' && (
          <View style={styles.restBadge}>
            <Text style={styles.restBadgeText}>RESTING</Text>
          </View>
        )}
      </View>

      {/* ---------- Bottom: the buttons ---------- */}
      <View
        style={[
          styles.footer,
          { paddingHorizontal: side, paddingBottom: Math.max(insets.bottom, 16) + 8 },
        ]}
      >
        {session.phase === 'idle' && (
          <PixelButton
            label="BEGIN"
            onPress={() => act('BEGIN')}
            fontSize={40}
            style={{ height: bigButtonHeight }}
            accessibilityLabel="Begin session"
          />
        )}

        {active && (
          <View style={[styles.buttonRow, { gap }]}>
            <PixelButton
              label={session.phase === 'training' ? 'REST' : 'RESUME'}
              caption={
                session.phase === 'training' ? 'set done? tap' : 'next set? tap'
              }
              onPress={() => act(session.phase === 'training' ? 'REST' : 'RESUME')}
              fontSize={session.phase === 'training' ? 40 : 30}
              style={{ flex: 2.3, height: bigButtonHeight }}
              accessibilityLabel={
                session.phase === 'training' ? 'Start rest' : 'Resume training'
              }
            />
            <PixelButton
              label={finishArmed ? 'SURE?' : 'FINISH'}
              caption={finishArmed ? 'tap again' : undefined}
              onPress={finish}
              palette={finishArmed ? palettes.redArmed : palettes.red}
              fontSize={finishFont}
              style={{ flex: 1, height: bigButtonHeight * 0.75, alignSelf: 'flex-end' }}
              accessibilityLabel={
                finishArmed ? 'Tap again to finish session' : 'Finish session'
              }
            />
          </View>
        )}

        {session.phase === 'summary' && (
          <PixelButton
            label="NEW SESSION"
            onPress={newSession}
            fontSize={22}
            style={{ height: bigButtonHeight * 0.8 }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.sky,
  },
  header: {
    backgroundColor: colors.sky,
    paddingBottom: 16,
  },
  hero: {
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 28,
  },
  title: {
    fontSize: 60,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.inkSoft,
    marginTop: 10,
    textAlign: 'center',
  },
  titleSmall: {
    fontSize: 30,
    fontWeight: '900',
    color: colors.ink,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  cards: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  noRests: {
    textAlign: 'center',
    marginTop: 16,
  },
  restList: {
    marginTop: 12,
    maxHeight: 192, // 10 rows x 2 columns = 20 rests; scrolls for more
  },
  restListContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: 14,
  },
  restColumn: {
    paddingHorizontal: 4,
  },
  restRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  restText: {
    fontFamily: pixelFont,
    fontSize: 10,
    lineHeight: 11,
    color: colors.ink,
  },
  summaryText: {
    fontFamily: pixelFont,
    fontSize: 12,
    color: colors.ink,
  },
  sceneBox: {
    flex: 1,
    minHeight: 120,
    overflow: 'hidden',
    backgroundColor: colors.floor,
  },
  // On the summary the picture gives up space so 20 rests fit on small phones.
  sceneBoxSummary: {
    minHeight: 0,
  },
  restBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    backgroundColor: colors.restCard,
    borderColor: colors.restAccent,
    borderWidth: 3,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  restBadgeText: {
    fontFamily: pixelFont,
    fontSize: 12,
    color: colors.restAccent,
    letterSpacing: 1,
  },
  footer: {
    backgroundColor: colors.floor,
    paddingTop: 16,
  },
  buttonRow: {
    flexDirection: 'row',
  },
});
