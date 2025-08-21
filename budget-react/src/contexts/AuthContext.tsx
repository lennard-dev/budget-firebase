import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { 
  onAuthChange, 
  signInWithGoogle, 
  signOutUser, 
  checkRedirectResult 
} from '../services/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Mock user for development - using the actual user ID from legacy app
const MOCK_USER = {
  uid: '7QGvBNZJKYgTD7NdlCrgSoMhujz2',  // Your actual Firebase user ID
  email: 'lennard.everwien@europecares.org',
  displayName: 'Lennard Everwien',
  photoURL: null,
  emailVerified: true,
  getIdToken: async () => 'mock-test-token-' + Date.now(),
} as any as User;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we should use mock auth
    const useMockAuth = localStorage.getItem('useMockAuth') === 'true';
    
    if (useMockAuth) {
      // Use mock authentication
      setUser(MOCK_USER);
      setLoading(false);
      return () => {};
    }

    // Check for redirect result on mount
    checkRedirectResult().then(redirectUser => {
      if (redirectUser) {
        setUser(redirectUser);
      }
    });

    // Subscribe to auth state changes
    const unsubscribe = onAuthChange((user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      setLoading(true);
      const user = await signInWithGoogle();
      if (user) {
        setUser(user);
      }
      // If null is returned, it means redirect was used
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await signOutUser();
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};