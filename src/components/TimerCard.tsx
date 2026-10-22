import { StyleSheet, Text, View } from 'react-native';
import { formatDuration } from '../session';
import { colors, pixelFont } from '../theme';

interface Props {
  title: string;
  ms: number;
  /** True while this clock is running; the other card is dimmed. */
  active: boolean;
  variant: 'training' | 'rest';
  /** Card width in px, used to fit the digits. */
  width: number;
}

export function TimerCard({ title, ms, active, variant, width }: Props) {
  const isTraining = variant === 'training';
  const accent = isTraining ? colors.trainingAccent : colors.restAccent;
  const time = formatDuration(ms);

  // Press Start 2P characters are about as wide as they are tall, so the
  // digits must fit "chars x size" inside the card. h:mm:ss gets smaller.
  const inner = width - 36;
  const digitSize = Math.max(14, Math.min(34, Math.floor(inner / time.length)));
  // Keep the label on one line, e.g. "TOTAL REST" on a narrow phone.
  const titleSize = Math.min(11, Math.floor(inner / (title.length * 1.15)));

  return (
    <View
      style={[
        styles.card,
        {
          width,
          backgroundColor: isTraining ? colors.trainingCard : colors.restCard,
          borderColor: active ? accent : '#2c4d5c',
          opacity: active ? 1 : 0.6,
        },
      ]}
      accessible
      accessibilityLabel={`${title} ${time}${active ? ', running' : ''}`}
    >
      <Text
        style={[
          styles.title,
          { fontSize: titleSize, color: isTraining ? '#d5efe2' : '#b8d6eb' },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.digits,
          { fontSize: digitSize, lineHeight: digitSize * 1.3 },
          !isTraining && { color: '#dceefb' },
        ]}
        numberOfLines={1}
      >
        {time}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 4,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowColor: colors.outline,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 4,
  },
  title: {
    fontFamily: pixelFont,
    letterSpacing: 1,
    marginBottom: 10,
  },
  digits: {
    fontFamily: pixelFont,
    color: colors.white,
  },
});
