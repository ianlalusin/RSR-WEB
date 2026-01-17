'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * This page is no longer in use and just redirects to the root.
 * The main dashboard is now at /app/page.tsx.
 */
export default function AppPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return null;
}
