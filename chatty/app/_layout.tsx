// app/_layout.tsx
// CRITICAL: Polyfills MUST be imported first
import '../polyfills';

import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, createContext } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as eva from '@eva-design/eva';
import { ApplicationProvider, Layout, Text } from '@ui-kitten/components';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth } from '@/config/firebase';
import encryptionService from '@/services/encryption.service';
import { IncomingCallListener } from '@/components/incoming-call';

export const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

export const unstable_settings = {
  initialRouteName: '(auth)',
};

export default function RootLayout() {
  const [theme, setTheme] = useState('light');
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    // Load saved theme
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('app-theme');
        if (savedTheme) {
          setTheme(savedTheme);
        }
      } catch (error) {
        console.error('Failed to load theme', error);
      }
    };
    loadTheme();
  }, []);

  useEffect(() => {
    console.log('🔍 Setting up auth listener...');
    
    const unsubscribe = auth().onAuthStateChanged(async (user: any) => {
      console.log('🔍 Auth state changed:', user ? `User: ${user.uid}` : 'No user');
      
      try {
        if (user) {
          console.log('🔐 Initializing encryption...');
          await encryptionService.initialize(user.uid);
          console.log('✅ Encryption initialized');
          setInitialRoute('/(tabs)');
        } else {
          console.log('👤 No user, going to login');
          setInitialRoute('/(auth)/login');
        }
      } catch (error) {
        console.error('❌ Error in auth handler:', error);
        setInitialRoute(user ? '/(tabs)' : '/(auth)/login');
      } finally {
        setIsReady(true);
      }
    });

    return () => {
      console.log('🧹 Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isReady && initialRoute) {
      console.log('🚀 Navigating to:', initialRoute);
      setTimeout(() => {
        router.replace(initialRoute as any);
      }, 100);
    }
  }, [isReady, initialRoute]);

  const toggleTheme = async () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    try {
      await AsyncStorage.setItem('app-theme', nextTheme);
    } catch (error) {
      console.error('Failed to save theme', error);
    }
  };

  if (!isReady) {
    return (
      <ApplicationProvider {...eva} theme={theme === 'light' ? eva.light : eva.dark}>
        <Layout style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#3366FF" />
          <Text category="s1" style={{ marginTop: 16 }}>Loading...</Text>
        </Layout>
      </ApplicationProvider>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <ApplicationProvider {...eva} theme={theme === 'light' ? eva.light : eva.dark}>
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="chat/[userId]" />
          <Stack.Screen name="call/[callId]" />
        </Stack>
        <IncomingCallListener />
      </ApplicationProvider>
    </ThemeContext.Provider>
  );
}