// app/_layout.tsx - Full Dark Mode
// CRITICAL: Polyfills MUST be imported first
import '../polyfills';

import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as eva from '@eva-design/eva';
import { ApplicationProvider, Layout, Text } from '@ui-kitten/components';

import { auth } from '@/config/firebase';
import authService from '@/services/auth.service';
import { IncomingCallListener } from '@/components/incoming-call';

export const unstable_settings = {
  initialRouteName: '(auth)',
};

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  useEffect(() => {
    console.log('🔍 Setting up auth listener...');
    
    const unsubscribe = auth().onAuthStateChanged(async (user: any) => {
      console.log('🔍 Auth state changed:', user ? `User: ${user.uid}` : 'No user');
      
      if (user) {
        try {
          // Initialize encryption
          console.log('🔐 Initializing encryption...');
          await authService.initializeEncryptionOnStartup(user.uid);
          console.log('✅ User authenticated and encryption ready');
          setInitialRoute('/(tabs)');
        } catch (error) {
          console.error('❌ Failed to initialize encryption:', error);
          setInitialRoute('/(tabs)'); // Still proceed, encryption will retry
        }
      } else {
        console.log('👤 No user - going to login');
        setInitialRoute('/(auth)/login');
      }
      
      setIsReady(true);
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

  if (!isReady) {
    return (
      <ApplicationProvider {...eva} theme={eva.dark}>
        <Layout style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1A1A1A' }}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text category="s1" style={{ marginTop: 16, color: '#FFFFFF' }}>Loading...</Text>
        </Layout>
      </ApplicationProvider>
    );
  }

  return (
    <ApplicationProvider {...eva} theme={eva.dark}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="chat/[userId]" />
        <Stack.Screen name="call/[callId]" />
        <Stack.Screen name="contact-profile/[userId]" />
        <Stack.Screen name="image-viewer/[messageId]" />
      </Stack>
      <IncomingCallListener />
    </ApplicationProvider>
  );
}