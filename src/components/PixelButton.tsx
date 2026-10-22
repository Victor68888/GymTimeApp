import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, pixelFont } from '../theme';

interface Palette {
  face: string;
  highlight: string;
  shadow: string;
}

export const palettes = {
  green: { face: colors.green, highlight: colors.greenLight, shadow: colors.greenDark },
  red: { face: colors.red, highlight: colors.redLight, shadow: colors.redDark },
  redArmed: { face: colors.redDark, highlight: colors.red, shadow: '#5e0f1a' },
} satisfies Record<string, Palette>;

interface Props {
  label: string;
  /** Small line under the label, e.g. "tap again". */
  caption?: string;
  onPress: () => void;
  palette?: Palette;
  /** Label size in px; the button grows to fit it. */
  fontSize?: number;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/**
 * Chunky pixel-style button: dark outline, lighter top edge and a thick
 * bottom edge that "sinks" when pressed so the tap is obvious.
 */
export function PixelButton({
  label,
  caption,
  onPress,
  palette = palettes.green,
  fontSize = 28,
  style,
  accessibilityLabel,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.outer, style]}
      hitSlop={8}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.face,
            {
              backgroundColor: palette.face,
              borderTopColor: palette.highlight,
              borderBottomColor: palette.shadow,
              borderBottomWidth: pressed ? 3 : 9,
              marginTop: pressed ? 6 : 0,
            },
          ]}
        >
          <Text
            style={[styles.label, { fontSize, lineHeight: fontSize * 1.25 }]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {label}
          </Text>
          {caption ? (
            <Text style={styles.caption} numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 4,
    borderColor: colors.outline,
    borderRadius: 10,
    backgroundColor: colors.outline,
    overflow: 'hidden',
  },
  face: {
    flex: 1,
    borderTopWidth: 5,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  label: {
    fontFamily: pixelFont,
    color: colors.white,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 0,
  },
  caption: {
    fontFamily: pixelFont,
    fontSize: 8,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 8,
  },
});
