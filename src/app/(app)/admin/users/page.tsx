'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserProfile } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { can } from '@/lib/permissions';
import { DataTable } from './data-table';
import { columns } from './columns';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';

export default function UserManagementPage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = can(userProfile, 'admin.users.manage');

  useEffect(() => {
    if (!canManage) {
      // Redirect or show access denied message
      router.replace('/'); 
      return;
    }

    const q = query(
      collection(db, 'users'),
      orderBy('displayName', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: UserProfile[] = snap.docs.map((d) => (d.data() as UserProfile));
      setUsers(data);
      setLoading(false);
    }, (error) => {
      console.error("Failed to fetch users:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [canManage, router]);


  if (!canManage) {
    return (
        <Card>
            <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
            <CardContent><p>You do not have permission to view this page.</p></CardContent>
        </Card>
    );
  }


  if (loading) {
    return (
      <Card>
        <CardHeader>
            <CardTitle>User Access Management</CardTitle>
            <CardDescription>
                Manage user roles, permissions, and active status.
            </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-48 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Access Management</CardTitle>
        <CardDescription>
          Manage user roles, permissions, and active status.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={users} />
      </CardContent>
    </Card>
  );
}
