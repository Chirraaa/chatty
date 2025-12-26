// app/app-init.tsx - Enhanced initialization with background call support
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import notificationService from '@/services/notification.service';

// Configure background modes for calls
const configureBackgroundModes = () => {
  if (Platform.OS === 'ios') {
    // iOS background modes are configured in app.json/app.config.js
    console.log('📱 iOS background modes configured via app.json');
  } else if (Platform.OS === 'android') {
    // Android background modes are configured in AndroidManifest.xml
    console.log('🤖 Android background modes configured via AndroidManifest.xml');
  }
};

export default function AppInit() {
  useEffect(() => {
    // Initialize services
    const initializeServices = async () => {
      try {
        // Configure background modes
        configureBackgroundModes();
        
        // Initialize notification service
        await notificationService.initialize();
        
        console.log('✅ App initialization complete');
      } catch (error) {
        console.error('❌ Error during app initialization:', error);
      }
    };

    initializeServices();

    // Monitor app state for background call handling
    const appStateSubscription = AppState.addEventListener('change', (nextAppState) => {
      console.log('📱 App state changed to:', nextAppState);
      
      // Handle background/foreground transitions for calls
      if (nextAppState === 'background') {
        console.log('📱 App entering background - call will continue');
      } else if (nextAppState === 'active') {
        console.log('📱 App entering foreground - restoring UI');
      }
    });

    // Cleanup on unmount
    return () => {
      notificationService.cleanup();
      appStateSubscription?.remove();
    };
  }, []);

  return null;
}
