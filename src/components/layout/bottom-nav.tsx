'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Landmark, Users, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Button } from '../ui/button';
import { useAuth } from '../providers/auth-provider';


const navItems = [
  { href: '/', icon: Home, label: 'Dashboard' },
  { href: '/barangays', icon: Landmark, label: 'Barangays' },
  { href: '/coordinators', icon: Users, label: 'Coordinators' },
];

export function BottomNav() {
  const pathname = usePathname();
  const { logout } = useAuth();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t bg-background/95 backdrop-blur-sm sm:hidden">
      <div className="flex h-16 items-center justify-around">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center gap-1 p-2 rounded-md text-muted-foreground transition-colors hover:text-foreground',
              (pathname === item.href || (item.href === '/' && pathname.startsWith('/dashboard'))) ? 'text-primary font-semibold' : ''
            )}
          >
            <item.icon className="h-6 w-6" />
            <span className="text-xs">{item.label}</span>
          </Link>
        ))}
        <Sheet>
          <SheetTrigger asChild>
            <button className='flex flex-col items-center gap-1 p-2 rounded-md text-muted-foreground'>
              <Menu className="h-6 w-6" />
              <span className="text-xs">More</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className='h-auto'>
              <div className="grid gap-4 py-4">
                  <Button variant="ghost" className="justify-start">Admin</Button>
                  <Button variant="ghost" className="justify-start" onClick={() => logout()}>Logout</Button>
              </div>
          </SheetContent>
        </Sheet>

      </div>
    </nav>
  );
}
