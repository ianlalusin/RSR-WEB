'use client';

import { ColumnDef } from '@tanstack/react-table';
import { UserProfile, UserRole } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/components/providers/auth-provider';
import { can } from '@/lib/permissions';
import { Switch } from '@/components/ui/switch';
import { updateUser } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import UserFormDialog from './_components/user-form-dialog';


async function handleActiveToggle(user: UserProfile, actor: UserProfile) {
    await updateUser(user.uid, { isActive: !user.isActive }, {uid: actor.uid, email: actor.email});
}

export const columns: ColumnDef<UserProfile>[] = [
  {
    accessorKey: 'displayName',
    header: ({ column }) => {
        return (
          <Button
            variant="ghost"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        )
      },
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'roles',
    header: 'Roles',
    cell: ({ row }) => {
        const roles: UserRole[] = row.getValue('roles') || [];
        return <div className='flex flex-wrap gap-1'>
            {roles.map(role => <Badge key={role} variant="secondary" className="capitalize">{role}</Badge>)}
        </div>
    }
  },
  {
    accessorKey: 'isActive',
    header: 'Active',
    cell: ({ row }) => {
      const user = row.original;
      const { userProfile: actor } = useAuth();
      const { toast } = useToast();
      const canManage = can(actor, 'admin.users.manage');

      const onToggle = async () => {
        if (!actor) return;
        try {
            await handleActiveToggle(user, actor);
            toast({ title: "Success", description: `${user.displayName}'s status updated.`})
        } catch (e: any) {
            toast({ variant: 'destructive', title: "Error", description: e.message })
        }
      }

      return (
        <Switch
          checked={user.isActive}
          onCheckedChange={onToggle}
          disabled={!canManage || user.uid === actor?.uid}
          aria-label="Toggle user active status"
        />
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const user = row.original;
      const { userProfile } = useAuth();
      const canManage = can(userProfile, 'admin.users.manage');

      if (!canManage) return null;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <UserFormDialog user={user}>
                 <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Roles & Permissions
                </DropdownMenuItem>
            </UserFormDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
