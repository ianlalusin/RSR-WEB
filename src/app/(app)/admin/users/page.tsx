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
import { isPlatformAdmin } from '@/lib/access';
import { DataTable } from './data-table';
import { columns } from './columns';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import UserAccessForm from './_components/user-access-form';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

function AccessDenied() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Access Denied</CardTitle>
            </CardHeader>
            <CardContent>
                <p>You do not have permission to view this page. This feature is for Platform Administrators only.</p>
            </CardContent>
        </Card>
    );
}

export default function UserManagementPage() {
  const { userProfile: actor } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const canManage = isPlatformAdmin(actor);

  useEffect(() => {
    if (!actor) return; // Wait for actor profile to load

    if (!canManage) {
      // It's better to show an access denied message than to redirect immediately.
      // A redirect can be jarring if the user briefly had access and then lost it.
      setLoading(false);
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
  }, [canManage, actor]);


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

  if (!canManage) {
    return <AccessDenied />;
  }

  const onUserSelect = (user: UserProfile) => {
    setSelectedUser(user);
  };
  
  const handleSuccess = () => {
    // The onSnapshot listener will automatically refresh the user list.
    // If we want to refresh the selected user's data in the form, we can find it in the new list.
    if(selectedUser) {
        const updatedUser = users.find(u => u.uid === selectedUser.uid);
        if (updatedUser) {
            setSelectedUser(updatedUser);
        }
    }
  }

  return (
    <div className="h-[calc(100vh-8rem)]">
        <ResizablePanelGroup direction="horizontal" className="h-full rounded-lg border">
             <ResizablePanel defaultSize={40}>
                <div className="p-4 h-full overflow-y-auto">
                    <h2 className="text-xl font-bold tracking-tight">Users</h2>
                    <p className="text-muted-foreground text-sm mb-4">Select a user to manage their access.</p>
                    <DataTable columns={columns} data={users} onUserSelect={onUserSelect} selectedUserId={selectedUser?.uid} />
                </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={60}>
                 <div className="p-6 h-full overflow-y-auto">
                    <h2 className="text-xl font-bold tracking-tight">Access Control</h2>
                    <p className="text-muted-foreground text-sm mb-4">Edit permissions for the selected user.</p>
                    {selectedUser ? (
                        <UserAccessForm key={selectedUser.uid} user={selectedUser} actor={actor!} onSuccess={handleSuccess} />
                    ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            <p>Select a user from the list to begin editing.</p>
                        </div>
                    )}
                </div>
            </ResizablePanel>
        </ResizablePanelGroup>
    </div>
  );
}
