
"use client";

import type { ReactNode, Dispatch, SetStateAction } from 'react';
import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '@/firebase'; // Your Firebase auth instance
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';


interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  isGuest: boolean;
  signInAsGuest: () => void;
  signUpWithEmail: (email: string, pass: string) => Promise<User | null>;
  signInWithEmail: (email: string, pass: string) => Promise<User | null>;
  signInWithGoogle: () => Promise<User | null>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setIsGuest(false);
        localStorage.removeItem('isGuest');
      }
      setLoading(false);
    });

    if (typeof window !== 'undefined' && localStorage.getItem('isGuest') === 'true') {
        setIsGuest(true);
    }

    return () => unsubscribe();
  }, []);

  const signInAsGuest = () => {
    if (user) return; // Don't allow guest mode if logged in
    setIsGuest(true);
    localStorage.setItem('isGuest', 'true');
    toast({ title: "Guest Mode Activated", description: "Your data will be stored locally on this device." });
  };


  const signUpWithEmail = async (email: string, pass: string): Promise<User | null> => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      setUser(userCredential.user);
      setIsGuest(false);
      localStorage.removeItem('isGuest');
      return userCredential.user;
    } catch (e: any) {
      setError(e.message);
      toast({ variant: "destructive", title: "Sign Up Failed", description: e.message });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const signInWithEmail = async (email: string, pass: string): Promise<User | null> => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      setUser(userCredential.user);
      setIsGuest(false);
      localStorage.removeItem('isGuest');
      return userCredential.user;
    } catch (e: any) {
      setError(e.message);
      toast({ variant: "destructive", title: "Sign In Failed", description: e.message });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (): Promise<User | null> => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      setUser(result.user);
      setIsGuest(false);
      localStorage.removeItem('isGuest');
      return result.user;
    } catch (e: any)
    {
      setError(e.message);
      toast({ variant: "destructive", title: "Google Sign In Failed", description: e.message });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const signOutUser = async () => {
    setLoading(true);
    setError(null);
    try {
      await signOut(auth);
      setUser(null);
      setIsGuest(false);
      localStorage.removeItem('isGuest');
    } catch (e: any) {
      setError(e.message);
      toast({ variant: "destructive", title: "Sign Out Failed", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    error,
    setError,
    isGuest,
    signInAsGuest,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signOutUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};
