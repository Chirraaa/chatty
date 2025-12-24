// config/firebase.ts
import { Platform } from 'react-native';

let auth: any;
let firestore: any;

if (Platform.OS === 'web') {
  // Use Firebase Web SDK for web platform
  const { initializeApp } = require('firebase/app');
  const { getAuth } = require('firebase/auth');
  const { getFirestore } = require('firebase/firestore');

  // For web, you'll need to provide your config manually
  // Get these values from your Firebase Console
  const firebaseConfig = {
    apiKey: "AIzaSyAv6IlseWgrqdWC1yK9bXTTaYibjTrs3Rg",
    authDomain: "chatty-adde4.firebaseapp.com",
    projectId: "chatty-adde4",
    storageBucket: "chatty-adde4.firebasestorage.app",
    messagingSenderId: "770730888216",
    appId: "770730888216:web:89a4920c081defeef4476d",
  };

  const app = initializeApp(firebaseConfig);
  auth = () => getAuth(app);
  firestore = () => getFirestore(app);

  console.log('✅ Firebase Web SDK initialized');

} else {
  // Use React Native Firebase for iOS/Android
  // This will automatically initialize using google-services.json and GoogleService-Info.plist
  const rnAuth = require('@react-native-firebase/auth').default;
  const rnFirestore = require('@react-native-firebase/firestore').default;

  auth = rnAuth;
  firestore = rnFirestore;

  // Configure Firestore settings after a short delay to ensure Firebase is initialized
  setTimeout(() => {
    try {
      firestore().settings({
        persistence: true,
        cacheSizeBytes: rnFirestore.CACHE_SIZE_UNLIMITED,
      });
      console.log('✅ Firestore configured with offline persistence');
    } catch (error) {
      // Settings already configured or Firebase not ready yet, ignore
      console.log('ℹ️ Firestore settings already configured or will be set later');
    }
  }, 100);

  console.log('✅ React Native Firebase loaded (will initialize from google-services files)');
}

export { auth, firestore };

export default {
  auth,
  firestore,
};