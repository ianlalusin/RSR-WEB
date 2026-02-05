'use client';

import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  UserProfile,
  Department,
  Role,
  PageKey,
} from '@/lib/types';
import { ALL_PAGE_KEYS } from '@/lib/access';
import { ChevronsUpDown, Edit } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import UserAccessEditDialog from './user-access-edit-dialog';

interface Props {
  user: UserProfile;
  actor: UserProfile;
  departments: Department[];
  roles: Role[];
  districts: { id: string; name: string }[];
  onSuccess?: () => void;
}

const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: 'Dashboard',
  barangays_list: 'Barangays (List)',
  barangay_detail: 'Barangay (Detail)',
  organization_orgMembers: 'Organization - Members',
  organization_departments: 'Organization - Departments',
  organization_roles: 'Organization - Roles',
  projects: 'Projects',
  analytics: 'Analytics',
  profile: 'User Profile',
  admin_users: 'Admin - User Management',
};

const DetailItem = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <p className="text-sm font-semibold text-muted-foreground">{label}</p>
    <div className="text-base mt-1">{children}</div>
  </div>
);

export default function UserAccessRow({ user, actor, departments, roles, districts, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const userRole = roles.find(p => p.id === user.roleId);
  const userDepartment = departments.find(d => d.id === user.departmentId);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-lg">
      <CollapsibleTrigger asChild>
        <button className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarImage src={user.photoURL || ''} alt={user.displayName || 'User'} />
              <AvatarFallback>{getInitials(user.displayName)}</AvatarFallback>
            </Avatar>
            <div className='flex flex-col items-start'>
              <span className="font-medium">{user.displayName}</span>
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {userDepartment && <Badge variant="secondary">{userDepartment.name}</Badge>}
            {userRole && <Badge variant="outline">{userRole.name}</Badge>}
            <Badge variant={user.isActive ? 'default' : 'secondary'} className={cn('border-transparent', user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
            <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 pt-0">
          <Separator className="mb-6" />
          <h3 className="text-xl font-semibold mb-4">{user.displayName}</h3>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <DetailItem label="Active Status">
                <Badge variant={user.isActive ? 'default' : 'secondary'} className={cn('border-transparent', user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
              </DetailItem>
              <DetailItem label="Department">
                <p>{userDepartment?.name || 'N/A'}</p>
              </DetailItem>
              <DetailItem label="Role">
                <p>{userRole?.name || 'N/A'}</p>
              </DetailItem>
            </div>

            <Separator />

            <DetailItem label="District Scope">
              {(user.access?.districtIds?.length || 0) > 0 ? (
                <div className="flex flex-wrap gap-2 mt-1">
                  {user.access.districtIds.map(id => {
                    const district = districts.find(d => d.id === id);
                    return district ? <Badge key={id} variant="secondary">{district.name}</Badge> : null;
                  })}
                </div>
              ) : <p className="text-muted-foreground">No districts assigned.</p>}
            </DetailItem>

            <Separator />

            <div>
              <p className="text-sm font-semibold text-muted-foreground mb-2">Page Permissions</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Page</TableHead>
                    <TableHead className="text-right">Access Level</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ALL_PAGE_KEYS.map((key) => (
                    <TableRow key={key}>
                      <TableCell>{PAGE_LABELS[key]}</TableCell>
                      <TableCell className="text-right capitalize">
                        {user.access?.pages?.[key]?.level || 'restricted'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end pt-4 border-t">
               <UserAccessEditDialog
                user={user}
                actor={actor}
                departments={departments}
                roles={roles}
                districts={districts}
                onSuccess={onSuccess}
              >
                <Button>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Access
                </Button>
              </UserAccessEditDialog>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
