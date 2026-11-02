import { fireEvent, render, waitFor } from '@testing-library/react-native';
import LoginScreen from '../src/screens/LoginScreen';
import { signInWithEmail, signUpWithEmail } from '../src/services/SupabaseAuthService';

jest.mock('../src/services/SupabaseAuthService', () => ({
    signInWithEmail: jest.fn(),
    signUpWithEmail: jest.fn(),
}));

const mockSignIn = jest.mocked(signInWithEmail);
const mockSignUp = jest.mocked(signUpWithEmail);

beforeEach(() => {
    jest.clearAllMocks();
});

test('asks the user to confirm email instead of entering the app without a session', async () => {
    mockSignUp.mockResolvedValue({ ok: true, authenticated: false });
    const onLogin = jest.fn();
    const screen = await render(<LoginScreen onLogin={onLogin} />);

    await fireEvent.changeText(screen.getByPlaceholderText('email'), 'user@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('password'), 'secret-password');
    await fireEvent.press(screen.getByText('Create account'));

    expect(await screen.findByText('Check your email to confirm your account, then log in.')).toBeTruthy();
    expect(onLogin).not.toHaveBeenCalled();
});

test('enters the app after a successful login creates a session', async () => {
    mockSignIn.mockResolvedValue({ ok: true, authenticated: true });
    const onLogin = jest.fn();
    const screen = await render(<LoginScreen onLogin={onLogin} />);

    await fireEvent.press(screen.getByText('Login'));
    await fireEvent.changeText(screen.getByPlaceholderText('email'), 'user@example.com');
    await fireEvent.changeText(screen.getByPlaceholderText('password'), 'secret-password');
    await fireEvent.press(screen.getByText('Log in'));

    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
});
