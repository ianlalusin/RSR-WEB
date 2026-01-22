'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import type { UserProfile, AccessLevel, PageKey } from '@/lib/types';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Landmark } from 'lucide-react';
import { ALL_PAGE_KEYS, defaultAccess, platformAdminAccess } from '@/lib/access';

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

  useEffect(() => {
    let unsubProfile: () => void = () => {};
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubProfile(); // Unsubscribe from previous user's profile listener
      
      if (firebaseUser) {
        setUser(firebaseUser);
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // Use a one-time getDoc for initial provisioning check
        const docSnap = await getDoc(userRef);

        if (!docSnap.exists()) {
          // User is logging in for the first time, provision their profile.
          const isSeedAdmin = firebaseUser.email === 'ianlalusin@gmail.com';
          
          const newUserProfile: Omit<UserProfile, 'roles' | 'permissions'> = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: isSeedAdmin ? 'Platform Admin' : firebaseUser.displayName || 'New User',
            photoURL: firebaseUser.photoURL || null,
            isActive: isSeedAdmin, // Only seed admin is active by default
            departmentId: isSeedAdmin ? 'admin' : undefined,
            positionId: isSeedAdmin ? 'platformAdmin' : undefined,
            access: isSeedAdmin ? platformAdminAccess : defaultAccess,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          await setDoc(userRef, newUserProfile);
        } else {
            const existingData = docSnap.data() as UserProfile;
            // Fallback for existing users without the new `access` structure
            if (!existingData.access) {
                await setDoc(userRef, {
                    access: defaultAccess,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            }
        }

        // After provisioning/checking, set up the real-time listener
        unsubProfile = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            setUserProfile(snapshot.data() as UserProfile);
          }
          setLoading(false);
        });

      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      unsubProfile();
    }
  }, []);

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
  
  if (loading) {
    return <FullScreenLoader />;
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
