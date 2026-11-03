import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
  testID?: string;
};

export default function ActionButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  testID = 'action-button',
}: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' ? styles.secondaryButton : styles.primaryButton,
        (pressed || loading) && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.text} />
      ) : (
        <Text style={[styles.text, variant === 'secondary' && styles.secondaryText]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 999,
    minWidth: 220,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: colors.spotifyGreen,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.8,
  },
  text: {
    fontSize: 18,
    color: colors.text,
  },
  secondaryText: {
    fontSize: 16,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
