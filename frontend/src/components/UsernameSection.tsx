import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors } from '../theme';
import {
  USERNAME_RULES,
  getMyUsername,
  normalizeUsername,
  updateMyUsername,
} from '../services/ProfileService';

const PANEL_COLOR = '#A3A3A3';

type Message = { kind: 'error' | 'success'; text: string };

export default function UsernameSection() {
  const [savedUsername, setSavedUsername] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    let isMounted = true;

    getMyUsername()
      .then((username) => {
        if (isMounted) {
          setSavedUsername(username);
          setDraft(username ?? '');
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setMessage({
            kind: 'error',
            text: error instanceof Error ? error.message : 'Could not load your username.',
          });
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const cleaned = normalizeUsername(draft);
  const hasChanges = cleaned.length > 0 && cleaned !== savedUsername;

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    const result = await updateMyUsername(draft);
    setIsSaving(false);

    if (result.ok) {
      setSavedUsername(result.username);
      setDraft(result.username);
      setMessage({ kind: 'success', text: 'Username saved!' });
    } else {
      setMessage({ kind: 'error', text: result.error });
    }
  };

  return (
    <View>
      <Text style={styles.sectionHeader}>PROFILE</Text>
      <View style={styles.panel}>
        <Text style={styles.label}>Username</Text>
        {savedUsername === null && !isLoading ? (
          <Text style={styles.note}>Pick a username so friends can find and add you.</Text>
        ) : null}

        {isLoading ? (
          <ActivityIndicator color={colors.text} style={styles.loading} />
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                setMessage(null);
              }}
              placeholder="username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              editable={!isSaving}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (hasChanges) void handleSave();
              }}
              accessibilityLabel="Username"
            />
            <Pressable
              onPress={() => void handleSave()}
              disabled={!hasChanges || isSaving}
              style={({ pressed }) => [
                styles.saveButton,
                (!hasChanges || isSaving) && styles.saveButtonDisabled,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <Text style={styles.saveButtonText}>{isSaving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.rules}>{USERNAME_RULES}</Text>
        {message ? (
          <Text style={message.kind === 'error' ? styles.errorText : styles.successText}>
            {message.text}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    fontSize: 17,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 8,
  },
  panel: {
    backgroundColor: PANEL_COLOR,
    padding: 14,
  },
  label: {
    fontSize: 15,
    color: colors.text,
  },
  note: {
    fontSize: 13,
    color: colors.text,
    marginTop: 4,
  },
  loading: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F2F2F2',
    height: 38,
    paddingHorizontal: 10,
    fontSize: 15,
    color: colors.text,
  },
  saveButton: {
    backgroundColor: '#E6E6E6',
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    color: colors.text,
  },
  pressed: {
    opacity: 0.7,
  },
  rules: {
    fontSize: 12,
    color: '#2B2D33',
    marginTop: 8,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    marginTop: 6,
  },
  successText: {
    fontSize: 13,
    color: '#1B5E20',
    marginTop: 6,
  },
});