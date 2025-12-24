// config/firebase.ts
import { Platform } from 'react-native';

// Firebase configuration from your .env
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
};
let auth: any;
let firestore: any;

if (Platform.OS === 'web') {
  // Use Firebase Web SDK for web platform
  const { initializeApp } = require('firebase/app');
  const { getAuth } = require('firebase/auth');
  const { getFirestore } = require('firebase/firestore');

  const app = initializeApp(firebaseConfig);
  auth = () => getAuth(app);
  firestore = () => getFirestore(app);

} else {
  // Use React Native Firebase for iOS/Android
  const rnAuth = require('@react-native-firebase/auth').default;
  const rnFirestore = require('@react-native-firebase/firestore').default;

  auth = rnAuth;
  firestore = rnFirestore;

  // Enable Firestore offline persistence for mobile
  firestore().settings({
    persistence: true,
    cacheSizeBytes: rnFirestore.CACHE_SIZE_UNLIMITED,
  });
}

export { auth, firestore };

export default {
  auth,
  firestore,
};