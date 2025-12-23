// config/firebase.ts
import { Platform } from 'react-native';

// Firebase configuration from your .env
const firebaseConfig = {
  apiKey: "AIzaSyDc2y0sq9ngz6zvXJxf1XEuQmb9YcbW4s8",
  authDomain: "chatty-adde4.firebaseapp.com",
  projectId: "chatty-adde4",
  storageBucket: "chatty-adde4.firebasestorage.app",
  messagingSenderId: "770730888216",
  appId: "1:770730888216:web:89a4920c081defeef4476d"
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