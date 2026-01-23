'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import type { UserProfile } from '@/lib/types';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Landmark } from 'lucide-react';
import { defaultAccess, platformAdminAccess } from '@/lib/access';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isPlatformAdminClaim: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  loginWithGoogle: () => Promise<any>;
  logout: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isPlatformAdminClaim: false,
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
  const [isPlatformAdminClaim, setIsPlatformAdminClaim] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubProfile: () => void = () => {};

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubProfile();
      setLoading(true);

      if (!firebaseUser) {
        setUser(null);
        setUserProfile(null);
        setIsPlatformAdminClaim(false);
        setLoading(false);
        return;
      }

      setUser(firebaseUser);

      // ✅ Custom claim is the source of truth
      const token = await firebaseUser.getIdTokenResult(true);
      const isAdmin = token?.claims?.platformAdmin === true;
      setIsPlatformAdminClaim(isAdmin);

      const userRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(userRef);

      // ✅ Only Platform Admin can auto-provision user profile (matches deployed rules)
      if (!docSnap.exists() && isAdmin) {
        const newUserProfile: Omit<UserProfile, 'roles' | 'permissions'> = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || 'Platform Admin',
          photoURL: firebaseUser.photoURL || null,
          isActive: true,
          departmentId: 'admin',
          positionId: 'platformAdmin',
          access: platformAdminAccess,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(userRef, newUserProfile);
      }

      // ✅ Optional: Platform Admin can apply migration defaults
      if (docSnap.exists() && isAdmin) {
        const existingData = docSnap.data() as UserProfile;
        if (!existingData.access) {
          await setDoc(
            userRef,
            { access: defaultAccess, updatedAt: serverTimestamp() },
            { merge: true }
          );
        }
      }

      unsubProfile = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) setUserProfile(snapshot.data() as UserProfile);
        else setUserProfile(null);
        setLoading(false);
      });
    });

    return () => {
      unsubscribe();
      unsubProfile();
    };
  }, []);

  const login = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);
  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
  const logout = () => firebaseSignOut(auth);

  const value = { user, userProfile, isPlatformAdminClaim, loading, login, loginWithGoogle, logout };

  if (loading) return <FullScreenLoader />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
