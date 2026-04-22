'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  getDocs,
  doc,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  UserProfile,
  Department,
  Role,
  DepartmentListDoc,
  RoleListDoc,
} from '@/lib/types';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage } from '@/lib/access';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
  const [roles, setRoles] = useState<Role[]>([]);
  const [districts, setDistricts] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const canManage = canViewPage(actor, 'admin_users', { isPlatformAdminClaim });

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

    const deptListRef = doc(db, 'lists', 'departments');
    const unsubDepartments = onSnapshot(deptListRef, async (snap) => {
      if (snap.exists()) {
        const listData = snap.data() as DepartmentListDoc;
        const depts = Object.entries(listData.departments || {}).map(([id, data]) => ({ id, ...data } as Department));
        setDepartments(depts.sort((a,b) => a.name.localeCompare(b.name)));
      } else {
        console.log("Departments list document not found on users page. Creating...");
        await setDoc(deptListRef, { departments: {} });
      }
    });

    const roleListRef = doc(db, 'lists', 'roles');
    const unsubRoles = onSnapshot(roleListRef, async (snap) => {
      if (snap.exists()) {
          const listData = snap.data() as RoleListDoc;
          const fetchedRoles = Object.entries(listData.roles || {}).map(([id, data]) => ({ id, ...data } as Role));
          setRoles(fetchedRoles.sort((a, b) => a.name.localeCompare(b.name)));
      } else {
           console.log("Roles list document not found on users page. Creating...");
           await setDoc(roleListRef, { roles: {} });
      }
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
        unsubRoles();
    };
  }, [canManage, actor]);
  
  const pendingUsers = useMemo(
    () => users.filter(u => !u.isActive || !u.roleId),
    [users]
  );

  const pendingUids = useMemo(() => new Set(pendingUsers.map(u => u.uid)), [pendingUsers]);

  const groupedUsers = useMemo(() => {
    if (!departments.length || !users.length) return [];

    const usersByDept: Record<string, UserProfile[]> = {};
    const unassignedUsers: UserProfile[] = [];

    users.forEach(user => {
        if (pendingUids.has(user.uid)) return; // shown in Pending section
        if (user.departmentId && departments.find(d => d.id === user.departmentId)) {
            if (!usersByDept[user.departmentId]) {
                usersByDept[user.departmentId] = [];
            }
            usersByDept[user.departmentId].push(user);
        } else {
            unassignedUsers.push(user);
        }
    });

    const sortedRoleIds = roles.sort((a, b) => a.name.localeCompare(b.name)).map(p => p.id);

    const result: GroupedUsers[] = departments.map(dept => ({
        department: dept,
        users: (usersByDept[dept.id] || []).sort((a, b) => {
            const posA = a.roleId ? sortedRoleIds.indexOf(a.roleId) : -1;
            const posB = b.roleId ? sortedRoleIds.indexOf(b.roleId) : -1;
            if (posA === posB) return (a.displayName || '').localeCompare(b.displayName || '');
            if (posA === -1) return 1;
            if (posB === -1) return -1;
            return posA - posB;
        }),
    }));
    
    if (unassignedUsers.length > 0) {
        result.push({
            department: { id: 'unassigned', name: 'Unassigned', createdAt: new Date() as any, updatedAt: new Date() as any, description: 'Users not assigned to a department.' },
            users: unassignedUsers.sort((a,b) => (a.displayName || '').localeCompare(b.displayName || ''))
        });
    }

    return result.filter(group => group.users.length > 0);
  }, [users, departments, roles]);

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
                    Manage user departments, roles, and page access permissions. Click on a user to expand their settings.
                </CardDescription>
            </CardHeader>
        </Card>

        {pendingUsers.length > 0 && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-amber-800 dark:text-amber-200">Pending Review</CardTitle>
                        <Badge variant="secondary" className="bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                            {pendingUsers.length}
                        </Badge>
                    </div>
                    <CardDescription>Users with no assigned role or inactive status requiring attention.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                    {pendingUsers.map(user => (
                        <UserAccessRow
                            key={user.uid}
                            user={user}
                            actor={actor!}
                            departments={departments}
                            roles={roles}
                            districts={districts}
                            onSuccess={handleSuccess}
                        />
                    ))}
                </CardContent>
            </Card>
        )}

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
                                roles={roles}
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
