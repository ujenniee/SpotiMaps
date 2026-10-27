import { useState } from 'react';
import {
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme';

type Props = {
    onLogin: () => void;
};

type Mode = 'signup' | 'login';


export default function LoginScreen({ onLogin }: Props) {
    const [mode, setMode] = useState<Mode>('signup');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    return (
        <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <View style={styles.container}>
                        <View style={styles.logoCircle}>
                            <Image
                                source={require('../../assets/logo.png')}
                                style={styles.logo}
                                resizeMode="contain"
                            />
                        </View>

                        <View>
                            <View style={styles.modeRow}>
                                <Pressable onPress={() => setMode('signup')} hitSlop={8}>
                                    <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>
                                        Sign up
                                    </Text>
                                </Pressable>
                                <Text style={styles.modeDivider}>|</Text>
                                <Pressable onPress={() => setMode('login')} hitSlop={8}>
                                    <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>
                                        Login
                                    </Text>
                                </Pressable>
                            </View>

                            <Text style={styles.label}>Username or email</Text>
                            <TextInput
                                style={styles.input}
                                value={username}
                                onChangeText={setUsername}
                                placeholder="username or email"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                autoCorrect={false}
                                keyboardType="email-address"
                                returnKeyType="next"
                            />

                            <Text style={styles.label}>Password</Text>
                            <TextInput
                                style={styles.input}
                                value={password}
                                onChangeText={setPassword}
                                placeholder="password"
                                placeholderTextColor={colors.textMuted}
                                secureTextEntry
                                autoCapitalize="none"
                                returnKeyType="done"
                            />
                        </View>

                        <Pressable
                            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                            onPress={onLogin}
                        >
                            <Text style={styles.buttonText}>Connect to Spotify</Text>
                        </Pressable>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: colors.cream,
    },
    flex: {
        flex: 1,
    },
    container: {
        flex: 1,
        paddingHorizontal: 32,
        paddingVertical: 24,
        justifyContent: 'space-between',
    },
    logoCircle: {
        alignSelf: 'center',
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        marginTop: 50,
        marginBottom: -80,
    },
    logo: {
        width: 240,
        height: 240,
    },
    modeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    modeText: {
        fontSize: 18,
        color: colors.textMuted,
    },
    modeTextActive: {
        color: colors.text,
        fontWeight: '600',
    },
    modeDivider: {
        fontSize: 18,
        color: colors.text,
        marginHorizontal: 8,
    },
    label: {
        fontSize: 16,
        color: colors.text,
        marginTop: 16,
        marginBottom: 6,
    },
    input: {
        backgroundColor: colors.input,
        height: 44,
        paddingHorizontal: 12,
        fontSize: 15,
        color: colors.text,
    },
    button: {
        alignSelf: 'center',
        backgroundColor: colors.spotifyGreen,
        paddingVertical: 16,
        paddingHorizontal: 40,
        borderRadius: 999,
        marginBottom: 60,
        marginTop: -30,
    },
    buttonPressed: {
        opacity: 0.7,
    },
    buttonText: {
        fontSize: 18,
        color: colors.text,
    },
});
