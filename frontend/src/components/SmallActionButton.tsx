import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

type Props = {
  label: string;
  variant?: 'light' | 'dark';
  disabled?: boolean;
  onPress?: () => void;
};

export default function SmallActionButton({
  label,
  variant = 'dark',
  disabled = false,
  onPress,
}: Props) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.smallButton,
        variant === 'light' ? styles.smallButtonLight : styles.smallButtonDark,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={variant === 'light' ? styles.smallButtonTextLight : styles.smallButtonTextDark}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  smallButton: {
    paddingVertical: 8,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 2,
  },
  smallButtonLight: {
    backgroundColor: colors.white,
  },
  smallButtonDark: {
    backgroundColor: '#4A4D5C',
  },
  smallButtonTextLight: {
    color: colors.textMuted,
    fontSize: 14,
  },
  smallButtonTextDark: {
    color: colors.white,
    fontSize: 14,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.8,
  },
});
