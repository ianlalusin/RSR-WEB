'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Landmark, Shield, LogOut, Briefcase, LineChart, HeartPulse, GraduationCap, Building, Inbox, ClipboardList, Megaphone } from 'lucide-react';
import { useAuth } from '../providers/auth-provider';
import { cn } from '@/lib/utils';
import { canViewPage, isPlatformAdmin, isOIC } from '@/lib/access';
import { PageKey } from '@/lib/types';

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  pageKeys: PageKey[];
}

const navItems: NavItem[] = [
  { href: '/', icon: Home, label: 'Dashboard', pageKeys: ['dashboard'] },
  { href: '/barangays', icon: Landmark, label: 'Barangays', pageKeys: ['barangays_list'] },
  { href: '/organization', icon: Briefcase, label: 'Organization', pageKeys: ['organization_orgMembers', 'organization_departments', 'organization_roles'] },
  { href: '/receiving', icon: Inbox, label: 'Receiving', pageKeys: ['receiving'] },
  { href: '/medical', icon: HeartPulse, label: 'Medical', pageKeys: ['projects_medical'] },
  { href: '/educational', icon: GraduationCap, label: 'Educational', pageKeys: ['projects_educational'] },
  { href: '/infrastructure', icon: Building, label: 'Infrastructure', pageKeys: ['projects_infrastructure'] },
  { href: '/tasker', icon: ClipboardList, label: 'Tasker', pageKeys: ['tasker'] },
  { href: '/analytics', icon: LineChart, label: 'Analytics', pageKeys: ['analytics'] },
  { href: '/socmed', icon: Megaphone, label: 'SocMed', pageKeys: ['socmed'] },
];

const adminNavItems = [
  { href: '/admin', icon: Shield, label: 'Admin' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, userProfile, isPlatformAdminClaim } = useAuth();

  const authOpts = { isPlatformAdminClaim };
  const isAdmin = isPlatformAdmin(userProfile, isPlatformAdminClaim) || isOIC(userProfile);

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-48 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col gap-1 px-3 py-4">
        <div className="flex flex-col px-3 mb-4">
          <Link href="/" className="text-2xl font-extrabold tracking-tight text-primary">
            TAPp
          </Link>
          <span className="text-[10px] text-muted-foreground leading-tight">Talino at Puso App</span>
        </div>

        {navItems.map((item) => (
          item.pageKeys.some(key => canViewPage(userProfile, key, authOpts)) && (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted',
                (pathname.startsWith(item.href) && item.href !== '/') || pathname === item.href
                  ? 'bg-accent text-accent-foreground font-medium'
                  : ''
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        ))}

        {isAdmin && (
          <>
            <div className="my-2 border-t" />
            {adminNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex h-9 items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted',
                  pathname.startsWith(item.href) ? 'bg-accent text-accent-foreground font-medium' : ''
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            ))}
          </>
        )}
      </nav>

      <nav className="mt-auto px-3 py-4">
        <button
          onClick={() => logout()}
          className="flex h-9 w-full items-center gap-3 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span>Logout</span>
        </button>
      </nav>
    </aside>
  );
}
