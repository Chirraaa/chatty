// app/(auth)/signup.tsx - Simplified
import { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, Alert, ScrollView } from 'react-native';
import { Link, router } from 'expo-router';
import { Layout, Text, Input, Button } from '@ui-kitten/components';
import authService from '@/services/auth.service';

export default function SignupScreen() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!username.trim() || !email.trim() || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (username.trim().length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      await authService.signUp(email.trim(), password, username.trim());
      
      Alert.alert(
        'Success!',
        'Your account has been created.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Signup error:', error);
      
      let message = 'Failed to create account. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        message = 'This email is already registered.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password is too weak. Use at least 6 characters.';
      }
      
      Alert.alert('Signup Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <Layout style={styles.container}>
          {/* Header */}
          <Layout style={styles.header}>
            <Text category='h1' style={styles.title}>Create Account</Text>
            <Text category='s1' appearance='hint'>Join and start chatting securely</Text>
          </Layout>

          {/* Form */}
          <Layout style={styles.form}>
            <Input
              style={styles.input}
              label='Username'
              placeholder='Choose a username'
              value={username}
              onChangeText={setUsername}
              autoCapitalize='none'
              disabled={loading}
            />

            <Input
              style={styles.input}
              label='Email'
              placeholder='your@email.com'
              value={email}
              onChangeText={setEmail}
              keyboardType='email-address'
              autoCapitalize='none'
              autoComplete='email'
              disabled={loading}
            />

            <Input
              style={styles.input}
              label='Password'
              placeholder='At least 6 characters'
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete='password-new'
              disabled={loading}
            />

            <Input
              style={styles.input}
              label='Confirm Password'
              placeholder='Re-enter password'
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoComplete='password-new'
              disabled={loading}
            />

            <Button
              style={styles.button}
              onPress={handleSignup}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>

            <Layout style={styles.linkContainer}>
              <Text appearance='hint'>Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <Text status='primary' style={styles.link}>Sign In</Text>
              </Link>
            </Layout>
          </Layout>
        </Layout>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 32,
  },
  title: {
    marginBottom: 8,
  },
  form: {
    width: '100%',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
  },
  linkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  link: {
    fontWeight: '600',
  },
});