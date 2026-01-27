'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * This page has been moved to /projects. This component just redirects.
 */
export default function AssistancePageRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/projects');
  }, [router]);

  return null;
}
