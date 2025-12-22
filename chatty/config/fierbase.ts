// config/firebase.ts
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Firebase is auto-initialized by @react-native-firebase
// Just export the instances for easy importing
export { auth, firestore };

// Enable Firestore offline persistence (optional but recommended)
firestore().settings({
  persistence: true,
  cacheSizeBytes: firestore.CACHE_SIZE_UNLIMITED,
});

export default {
  auth,
  firestore,
};