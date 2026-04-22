'use server';

import { adminAuth, adminDb } from './firebase-admin';
import type { UserProfile } from './types';

export interface VerifiedActor {
  uid: string;
  email: string | null;
  isPlatformAdmin: boolean;
  profile: UserProfile | null;
}

export async function assertActor(idToken: string): Promise<VerifiedActor> {
  if (!idToken) {
    throw new Error('Authentication required.');
  }

  const decoded = await adminAuth.verifyIdToken(idToken);
  const isPlatformAdmin = decoded.platformAdmin === true;

  const profileSnap = await adminDb.collection('users').doc(decoded.uid).get();
  const profile = profileSnap.exists ? (profileSnap.data() as UserProfile) : null;

  if (!profile) {
    if (isPlatformAdmin) {
      console.warn(
        `[assertActor] platformAdmin bypass: no users/${decoded.uid} doc found; allowing.`,
      );
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        isPlatformAdmin: true,
        profile: null,
      };
    }
    throw new Error('Your account is not provisioned. Contact an administrator.');
  }

  if (profile.isActive !== true) {
    if (isPlatformAdmin) {
      console.warn(
        `[assertActor] platformAdmin bypass: users/${decoded.uid} isActive=${profile.isActive}; allowing.`,
      );
      return {
        uid: decoded.uid,
        email: decoded.email ?? null,
        isPlatformAdmin: true,
        profile,
      };
    }
    throw new Error('Your account is disabled. Contact an administrator.');
  }

  return {
    uid: decoded.uid,
    email: decoded.email ?? null,
    isPlatformAdmin,
    profile,
  };
}
