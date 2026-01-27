'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Department, Position, UserProfile } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const getOrgMemberColumns = (departments: Department[], positions: Position[]): ColumnDef<UserProfile>[] => [
  {
    accessorKey: 'displayName',
    header: 'Name',
  },
  {
    header: 'Department',
    accessorKey: 'departmentId',
    cell: ({ row }) => {
        const department = departments.find(d => d.id === row.original.departmentId);
        return department?.name || 'N/A';
    }
  },
  {
    header: 'Position',
    accessorKey: 'positionId',
     cell: ({ row }) => {
        const position = positions.find(p => p.id === row.original.positionId);
        return position?.name || 'N/A';
    }
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => {
      const isActive = row.getValue('isActive') as boolean;
      return (
        <Badge variant={isActive ? 'default' : 'secondary'} className={cn('capitalize', isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
          {isActive ? 'Active' : 'Inactive'}
        </Badge>
      );
    },
  },
];
