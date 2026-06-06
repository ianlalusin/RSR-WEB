import type { Metadata } from 'next';
import Link from 'next/link';
import { Landmark } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Recto Tulong Dunong Scholarship — Online Registration',
  description:
    'Online registration form for the Recto Tulong Dunong Scholarship Program under the Office of Hon. Ryan Christian S. Recto, 6th District of Batangas.',
};

/**
 * Public scholarship layout. This sits OUTSIDE the (app) auth wrapper
 * so applicants do not need to sign in. Brand chrome uses Cong. Recto's
 * signature light blue (#00A8E8).
 */
export default function ScholarshipPublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header
        className="border-b text-white shadow-sm"
        style={{ backgroundColor: '#00A8E8' }}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-1 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <Landmark className="h-7 w-7 shrink-0" aria-hidden="true" />
            <div className="flex flex-col leading-tight">
              <span className="text-xs font-semibold uppercase tracking-wide opacity-90">
                Office of Hon. Ryan Christian S. Recto
              </span>
              <span className="text-[11px] opacity-80">
                Representative, 6th District of Batangas
              </span>
            </div>
          </div>
          <div className="mt-2">
            <h1 className="text-lg font-bold sm:text-xl">
              Tulong Dunong Scholarship — Online Registration
            </h1>
            <p className="text-xs opacity-90">#aksyonaRYAN</p>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-10">{children}</div>
      </main>

      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-4xl flex-col gap-1 px-4 py-4 text-xs text-muted-foreground sm:px-6 sm:flex-row sm:items-center sm:justify-between">
          <span>
            &copy; {new Date().getFullYear()} Office of Hon. Ryan Christian S. Recto. All rights reserved.
          </span>
          <Link href="/login" className="font-medium hover:underline" style={{ color: '#00A8E8' }}>
            Staff sign-in
          </Link>
        </div>
      </footer>
    </div>
  );
}
