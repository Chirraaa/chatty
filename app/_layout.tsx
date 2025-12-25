// app/_layout.tsx - With notification initialization
import '../polyfills';
import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as eva from '@eva-design/eva';
import { ApplicationProvider, IconRegistry } from '@ui-kitten/components';
import { EvaIconsPack } from '@ui-kitten/eva-icons';
import { auth } from '@/config/firebase';
import authService from '@/services/auth.service';
import notificationService from '@/services/notification.service';
import { IncomingCallListener } from '@/components/incoming-call';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

export default function RootLayout() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth().onAuthStateChanged(async (user: FirebaseAuthTypes.User | null) => {
      console.log('🔐 Auth state changed:', user ? 'Authenticated' : 'Not authenticated');
      
      if (user) {
        try {
          // Initialize encryption
          await authService.initializeEncryptionOnStartup(user.uid);
          
          // Initialize notifications
          await notificationService.initialize();
          
          setIsAuthenticated(true);
          console.log('✅ User authenticated and services initialized');
        } catch (error) {
          console.error('❌ Service initialization failed:', error);
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
      
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle navigation based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      // Not authenticated and not in auth screens - redirect to login
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Authenticated but still on auth screens - redirect to tabs
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, isLoading]);

  if (isLoading) {
    return null;
  }

  return (
    <>
      <IconRegistry icons={EvaIconsPack} />
      <ApplicationProvider {...eva} theme={eva.dark}>
        <SafeAreaProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="chat/[userId]" options={{ headerShown: false }} />
            <Stack.Screen name="call/[callId]" options={{ headerShown: false }} />
            <Stack.Screen name="contact-profile/[userId]" options={{ headerShown: false }} />
            <Stack.Screen name="image-viewer/[messageId]" options={{ headerShown: false }} />
          </Stack>
          {isAuthenticated && <IncomingCallListener />}
        </SafeAreaProvider>
      </ApplicationProvider>
    </>
  );
}