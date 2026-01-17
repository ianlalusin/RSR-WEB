"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserProfile } from "@/lib/permissions";

export function useUserProfile(uid?: string | null) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(!!uid);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setProfile((snap.data() as UserProfile) ?? null);
        setLoading(false);
      },
      () => {
        setProfile(null);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [uid]);

  return { profile, loading };
}
