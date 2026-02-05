'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Home, Landmark, Shield, LogOut, HeartHandshake, Briefcase, LineChart, Building2 } from 'lucide-react';
import { useAuth } from '../providers/auth-provider';
import { cn } from '@/lib/utils';
import { canViewPage, isPlatformAdmin } from '@/lib/access';
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
  { href: '/projects', icon: HeartHandshake, label: 'Projects', pageKeys: ['projects', 'projects_medical', 'projects_hospitals'] },
  { href: '/analytics', icon: LineChart, label: 'Analytics', pageKeys: ['analytics'] },
];

const adminNavItems = [
  { href: '/admin/users', icon: Shield, label: 'User Access' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, userProfile, isPlatformAdminClaim } = useAuth();

  const authOpts = { isPlatformAdminClaim };
  const isAdmin = isPlatformAdmin(userProfile, isPlatformAdminClaim);

  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <TooltipProvider>
        <nav className="flex flex-col items-center gap-4 px-2 py-4">
          <Link
            href="/"
            className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
          >
            <Landmark className="h-4 w-4 transition-all group-hover:scale-110" />
            <span className="sr-only">RSR Web</span>
          </Link>

          {navItems.map((item) => (
            item.pageKeys.some(key => canViewPage(userProfile, key, authOpts)) && (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                      (pathname.startsWith(item.href) && item.href !== '/') || pathname === item.href
                        ? 'bg-accent text-accent-foreground'
                        : ''
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="sr-only">{item.label}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            )
          ))}

          {isAdmin &&
            adminNavItems.map((item) => (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                      pathname.startsWith(item.href) ? 'bg-accent text-accent-foreground' : ''
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="sr-only">{item.label}</span>
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            ))}
        </nav>

        <nav className="mt-auto flex flex-col items-center gap-4 px-2 py-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => logout()}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
              >
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logout</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Logout</TooltipContent>
          </Tooltip>
        </nav>
      </TooltipProvider>
    </aside>
  );
}
