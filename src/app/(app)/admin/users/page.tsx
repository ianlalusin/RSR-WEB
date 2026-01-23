'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserProfile, Department, Position } from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { isPlatformAdmin } from '@/lib/access';
import { Skeleton } from '@/components/ui/skeleton';
import UserAccessRow from './_components/user-access-row';

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

interface GroupedUsers {
    department: Department;
    users: UserProfile[];
}

export default function UserManagementPage() {
  const { userProfile: actor, isPlatformAdminClaim } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = isPlatformAdmin(actor, isPlatformAdminClaim);

  const handleSuccess = () => {
    // This function can be used to trigger a re-fetch or state update if needed
    // For now, onSnapshot handles real-time updates.
  }

  useEffect(() => {
    if (!actor) return;
    if (!canManage) {
      setLoading(false);
      return;
    }

    const unsubUsers = onSnapshot(query(collection(db, 'users'), orderBy('displayName', 'asc')), (snap) => {
        setUsers(snap.docs.map((d) => (d.data() as UserProfile)));
        setLoading(false);
    }, (error) => {
      console.error("Failed to fetch users:", error);
      setLoading(false);
    });

    const unsubDepartments = onSnapshot(query(collection(db, 'departments'), orderBy('name', 'asc')), (snap) => {
        setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() } as Department)));
    });

    const unsubPositions = onSnapshot(query(collection(db, 'positions'), orderBy('name', 'asc')), (snap) => {
        setPositions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Position)));
    });
    
    const fetchDistricts = async () => {
        const q = query(collection(db, 'barangays'));
        const querySnapshot = await getDocs(q);
        const uniqueDistricts = new Map<string, string>();
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if(data.districtId && data.districtName) {
                uniqueDistricts.set(data.districtId, data.districtName);
            }
        });
        setDistricts(Array.from(uniqueDistricts, ([id, name]) => ({ id, name })).sort((a,b) => a.name.localeCompare(b.name)));
    };
    fetchDistricts();


    return () => {
        unsubUsers();
        unsubDepartments();
        unsubPositions();
    };
  }, [canManage, actor]);
  
  const groupedUsers = useMemo(() => {
    if (!departments.length || !users.length) return [];
    
    const usersByDept: Record<string, UserProfile[]> = {};
    const unassignedUsers: UserProfile[] = [];

    users.forEach(user => {
        if (user.departmentId && departments.find(d => d.id === user.departmentId)) {
            if (!usersByDept[user.departmentId]) {
                usersByDept[user.departmentId] = [];
            }
            usersByDept[user.departmentId].push(user);
        } else {
            unassignedUsers.push(user);
        }
    });

    const sortedPositionIds = positions.sort((a, b) => a.name.localeCompare(b.name)).map(p => p.id);

    const result: GroupedUsers[] = departments.map(dept => ({
        department: dept,
        users: (usersByDept[dept.id] || []).sort((a, b) => {
            const posA = a.positionId ? sortedPositionIds.indexOf(a.positionId) : -1;
            const posB = b.positionId ? sortedPositionIds.indexOf(b.positionId) : -1;
            if (posA === posB) return (a.displayName || '').localeCompare(b.displayName || '');
            if (posA === -1) return 1;
            if (posB === -1) return -1;
            return posA - posB;
        }),
    }));
    
    if (unassignedUsers.length > 0) {
        result.push({
            department: { id: 'unassigned', name: 'Unassigned', createdAt: new Date(), updatedAt: new Date(), description: 'Users not assigned to a department.' },
            users: unassignedUsers.sort((a,b) => (a.displayName || '').localeCompare(b.displayName || ''))
        });
    }

    return result.filter(group => group.users.length > 0);
  }, [users, departments, positions]);

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
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!canManage) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <CardTitle>User Access Management</CardTitle>
                <CardDescription>
                    Manage user departments, positions, and page access permissions. Click on a user to expand their settings.
                </CardDescription>
            </CardHeader>
        </Card>
        <div className="space-y-6">
            {groupedUsers.map(({ department, users }) => (
                <Card key={department.id}>
                    <CardHeader>
                        <CardTitle>{department.name}</CardTitle>
                        <CardDescription>{users.length} member(s)</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {users.map(user => (
                            <UserAccessRow 
                                key={user.uid}
                                user={user}
                                actor={actor!}
                                departments={departments}
                                positions={positions}
                                districts={districts}
                                onSuccess={handleSuccess}
                            />
                        ))}
                    </CardContent>
                </Card>
            ))}
        </div>
    </div>
  );
}
