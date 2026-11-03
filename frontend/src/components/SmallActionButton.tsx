import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';

type Props = {
  label: string;
  variant?: 'light' | 'dark';
  disabled?: boolean;
};

export default function SmallActionButton({ label, variant = 'dark', disabled = false }: Props) {
  return (
    <Pressable
      disabled={disabled}
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
    paddingVertical: 6,
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
    fontSize: 12,
  },
  smallButtonTextDark: {
    color: colors.white,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.8,
  },
});
