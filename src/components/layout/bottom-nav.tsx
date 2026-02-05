'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Landmark, Menu, User, Shield, HeartHandshake, Briefcase, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from '../ui/button';
import { useAuth } from '../providers/auth-provider';
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
  { href: '/projects', icon: HeartHandshake, label: 'Projects', pageKeys: ['projects'] },
  { href: '/analytics', icon: LineChart, label: 'Analytics', pageKeys: ['analytics'] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { logout, userProfile, isPlatformAdminClaim } = useAuth();

  const authOpts = { isPlatformAdminClaim };
  const isAdmin = isPlatformAdmin(userProfile, isPlatformAdminClaim);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur-sm sm:hidden">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => (
          item.pageKeys.some(key => canViewPage(userProfile, key, authOpts)) && (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 p-2 rounded-md text-muted-foreground transition-colors hover:text-foreground',
                (pathname.startsWith(item.href) && item.href !== '/') || pathname === item.href ? 'text-primary font-semibold' : ''
              )}
            >
              <item.icon className="h-6 w-6" />
              <span className="text-xs">{item.label}</span>
            </Link>
          )
        ))}

        <Sheet>
          <SheetTrigger asChild>
            <button className="flex flex-col items-center gap-1 p-2 rounded-md text-muted-foreground">
              <Menu className="h-6 w-6" />
              <span className="text-xs">More</span>
            </button>
          </SheetTrigger>

          <SheetContent side="bottom" className="h-auto rounded-t-lg">
            <div className="grid grid-cols-2 gap-2 p-4">
              {canViewPage(userProfile, 'profile', authOpts) && (
                <Button asChild variant="outline" className="flex-col h-20">
                  <Link href="/profile">
                    <User className="h-6 w-6 mb-1" />
                    Profile
                  </Link>
                </Button>
              )}

              {isAdmin && (
                <Button asChild variant="outline" className="flex-col h-20">
                  <Link href="/admin/users">
                    <Shield className="h-6 w-6 mb-1" />
                    User Access
                  </Link>
                </Button>
              )}

              <Button variant="outline" className="flex-col h-20 col-span-2" onClick={() => logout()}>
                Logout
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </nav>
  );
}
