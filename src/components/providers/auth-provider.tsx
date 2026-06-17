'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, db, googleProvider } from '@/lib/firebase';
import type { UserProfile, Role, RoleListDoc } from '@/lib/types';
import { doc, onSnapshot, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Landmark } from 'lucide-react';
import { defaultAccess } from '@/lib/access';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  roles: Role[];
  isPlatformAdminClaim: boolean;
  loading: boolean;
  login: (email: string, pass: string) => Promise<any>;
  signup: (email: string, pass: string, displayName: string) => Promise<any>;
  loginWithGoogle: () => Promise<any>;
  logout: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  roles: [],
  isPlatformAdminClaim: false,
  loading: true,
  login: async () => {},
  signup: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
});

const FullScreenLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-2">
      <span className="text-5xl font-extrabold tracking-tight text-primary animate-pulse">TAPp</span>
      <p className="text-xs text-muted-foreground">Talino at Puso App</p>
    </div>
  </div>
);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isPlatformAdminClaim, setIsPlatformAdminClaim] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rolesRef = doc(db, 'lists', 'roles');
    const unsubRoles = onSnapshot(rolesRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as RoleListDoc;
        setRoles(
          Object.entries(data.roles || {}).map(([id, r]) => ({ id, ...r } as Role))
        );
      }
    });

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

      // Custom claim is the source of truth for admin status
      const token = await firebaseUser.getIdTokenResult(true);
      const isAdmin = token?.claims?.platformAdmin === true;
      setIsPlatformAdminClaim(isAdmin);

      const userRef = doc(db, 'users', firebaseUser.uid);
      const docSnap = await getDoc(userRef);

      if (!docSnap.exists()) {
        // Reload so displayName is populated after updateProfile (email/pw signup race)
        await firebaseUser.reload();
        const freshUser = auth.currentUser!;

        // Self-provision a MINIMAL pending doc. The Firestore create rule only
        // permits a self-created users doc when isActive == false and it carries no
        // access / roleId / socmedRole (an admin assigns those later via Admin SDK).
        // Previously this sent `access` (and isActive:true + roleId for admins), so
        // the create was rejected with permission-denied and pending signups never
        // got a users doc — making them invisible in the admin Pending Review list.
        // (Admin status is driven by the platformAdmin custom claim, not this doc;
        // the in-memory sanitizer below fills access until an admin approves.)
        const newUserProfile: Record<string, unknown> = {
          uid: freshUser.uid,
          email: freshUser.email,
          displayName: freshUser.displayName,
          photoURL: freshUser.photoURL ?? null,
          isActive: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        try {
          await setDoc(userRef, newUserProfile);
        } catch (err) {
          console.error('[AuthProvider] Failed to create user profile:', err);
        }
      }

      unsubProfile = onSnapshot(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const profileData = snapshot.data() as UserProfile;

          // Data Sanitization: Check for malformed access object, which is the likely cause of crashes.
          // This provides an in-memory "migration" for users with old/bad data structure in Firestore.
          if (!profileData.access || typeof profileData.access !== 'object' || Array.isArray(profileData.access) || !profileData.access.pages || typeof profileData.access.pages !== 'object' || Array.isArray(profileData.access.pages)) {
            console.warn("User profile has malformed 'access' property. Applying default permissions.", profileData.uid);
            profileData.access = defaultAccess; 
          }
          
          // Ensure districtIds is always an array
          if (!Array.isArray(profileData.access.districtIds)) {
            profileData.access.districtIds = [];
          }
          
          setUserProfile(profileData);
        } else {
          // This case is now unlikely for an authenticated user, but handled just in case.
          setUserProfile(null);
        }
        setLoading(false);
      });
    });

    return () => {
      unsubRoles();
      unsubscribe();
      unsubProfile();
    };
  }, []);

  const login = (email: string, pass: string) => signInWithEmailAndPassword(auth, email, pass);

  const signup = async (email: string, pass: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName });
    return cred;
  };

  const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
  const logout = () => firebaseSignOut(auth);

  const value = { user, userProfile, roles, isPlatformAdminClaim, loading, login, signup, loginWithGoogle, logout };

  if (loading) return <FullScreenLoader />;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);