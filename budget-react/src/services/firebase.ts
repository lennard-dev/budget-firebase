import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup,
  signOut,
  // onAuthStateChanged // Commented out for mock auth
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBm1sz99XXrKjqBh3hMAozBnxE-u3T5kzc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "budget-v01.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "budget-v01",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "budget-v01.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "948728322734",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:948728322734:web:8c3a9e8f9c3e8d5b3e8d5b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Auth providers
export const googleProvider = new GoogleAuthProvider();

// Auth functions
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Mock user for development (matching legacy app)
// The token must match what getCurrentUserToken returns
const MOCK_TOKEN = 'mock-test-token-001';
const MOCK_USER = {
  uid: 'test-admin-user-001',
  email: 'lennard.everwien@europecares.org',
  displayName: 'Lennard Everwien',
  photoURL: null,
  emailVerified: true,
  getIdToken: async () => MOCK_TOKEN,
} as any as User;

// Auth state observer with mock user auto-login
export const onAuthChange = (callback: (user: User | null) => void) => {
  // Auto-login with mock user for development
  setTimeout(() => {
    callback(MOCK_USER);
  }, 100);
  
  // Return unsubscribe function
  return () => {};
  
  // Original auth observer (disabled for now)
  // return onAuthStateChanged(auth, callback);
};

// Get current user token (returns mock token for now)
export const getCurrentUserToken = async (): Promise<string | null> => {
  // Return mock token for development - must match MOCK_TOKEN
  return MOCK_TOKEN;
  
  // Original implementation (disabled for now)
  // const user = auth.currentUser;
  // if (user) {
  //   try {
  //     return await user.getIdToken();
  //   } catch (error) {
  //     console.error('Error getting user token:', error);
  //     return null;
  //   }
  // }
  // return null;
};