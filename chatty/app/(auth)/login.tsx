// app/(auth)/login.tsx - Simplified
import { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { Link } from 'expo-router';
import { Layout, Text, Input, Button } from '@ui-kitten/components';
import authService from '@/services/auth.service';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      await authService.signIn(email.trim(), password);
      // Success! Navigation will be handled automatically by _layout.tsx
    } catch (error: any) {
      console.error('Login error:', error);
      
      let message = 'Failed to sign in. Please try again.';
      if (error.code === 'auth/user-not-found') {
        message = 'No account found with this email.';
      } else if (error.code === 'auth/wrong-password') {
        message = 'Incorrect password.';
      } else if (error.code === 'auth/invalid-email') {
        message = 'Invalid email address.';
      } else if (error.code === 'auth/invalid-credential') {
        message = 'Invalid email or password.';
      }
      
      Alert.alert('Login Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <Layout style={styles.container}>
        {/* Header */}
        <Layout style={styles.header}>
          <Text category='h1' style={styles.title}>Welcome Back</Text>
          <Text category='s1' appearance='hint'>Sign in to continue</Text>
        </Layout>

        {/* Form */}
        <Layout style={styles.form}>
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
            placeholder='••••••••'
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete='password'
            disabled={loading}
          />

          <Button
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </Button>

          <Layout style={styles.linkContainer}>
            <Text appearance='hint'>Don't have an account? </Text>
            <Link href="/(auth)/signup" asChild>
              <Text status='primary' style={styles.link}>Sign Up</Text>
            </Link>
          </Layout>
        </Layout>
      </Layout>
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