'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import type { UserProfile } from '@/lib/types';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { usePathname, useRouter } from 'next/navigation';
import AppLayout from '../layout/app-layout';
import { Landmark } from 'lucide-react';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  loginWithGoogle: () => Promise<any>;
  logout: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  login: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
});

const FullScreenLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <Landmark className="h-16 w-16 animate-pulse text-primary" />
      <p className="text-muted-foreground">Loading RSR Web...</p>
    </div>
  </div>
);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        const userRef = doc(db, 'users', firebaseUser.uid);
        onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile(snapshot.data() as UserProfile);
          } else {
            // Auto-provision user on first login
            const isSeedAdmin = firebaseUser.email === 'ianlalusin@gmail.com';
            const newUserProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName,
              photoURL: firebaseUser.photoURL || null,
              roles: isSeedAdmin ? ['admin'] : [],
              permissions: {},
              isActive: isSeedAdmin,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
            setDoc(userRef, newUserProfile);
            setUserProfile(newUserProfile);
          }
        });

      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const publicPaths = ['/login'];
    const isPublicPath = publicPaths.includes(pathname);

    if (!loading) {
      if (!user && !isPublicPath) {
        router.push('/login');
      } else if (user && isPublicPath) {
        router.push('/');
      }
    }
  }, [user, loading, pathname, router]);

  const login = (email: string, pass: string) => {
    return signInWithEmailAndPassword(auth, email, pass);
  };
  
  const loginWithGoogle = () => {
    return signInWithPopup(auth, googleProvider);
  };

  const logout = () => {
    return firebaseSignOut(auth);
  };

  const value = { user, userProfile, loading, login, loginWithGoogle, logout };
  
  const isAppRoute = !['/login', '/'].includes(pathname) && !pathname.startsWith('/_next');

  if (loading) {
    return <FullScreenLoader />;
  }
  
  if (isAppRoute) {
     if (!user) return <FullScreenLoader />;
     return <AuthContext.Provider value={value}><AppLayout>{children}</AppLayout></AuthContext.Provider>;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
