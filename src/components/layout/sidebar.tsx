'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Home, Landmark, Users, Shield, LogOut, HeartHandshake, Briefcase, LineChart } from 'lucide-react';
import { useAuth } from '../providers/auth-provider';
import { cn } from '@/lib/utils';
import { hasPerm } from '@/lib/permissions';

const navItems = [
  { href: '/', icon: Home, label: 'Dashboard' },
  { href: '/barangays', icon: Landmark, label: 'Barangays' },
  { href: '/coordinators', icon: Briefcase, label: 'Organization' },
  { href: '/assistance', icon: HeartHandshake, label: 'Projects' },
  { href: '/analytics', icon: LineChart, label: 'Analytics' },
];

const adminNavItems = [
  { href: '/admin/users', icon: Shield, label: 'User Access', permission: 'admin.users.manage' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout, userProfile } = useAuth();

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
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>
                <Link
                  href={item.href}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                    (pathname.startsWith(item.href) && item.href !== '/') || pathname === item.href ? 'bg-accent text-accent-foreground' : ''
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="sr-only">{item.label}</span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          ))}
          {adminNavItems.map((item) => (
            hasPerm(userProfile, item.permission) && (
             <Tooltip key={item.href}>
             <TooltipTrigger asChild>
               <Link
                 href={item.href}
                 className={cn(
                   'flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8',
                   pathname.startsWith(item.href) && 'bg-accent text-accent-foreground'
                 )}
               >
                 <item.icon className="h-5 w-5" />
                 <span className="sr-only">{item.label}</span>
               </Link>
             </TooltipTrigger>
             <TooltipContent side="right">{item.label}</TooltipContent>
           </Tooltip>
          )))}
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
