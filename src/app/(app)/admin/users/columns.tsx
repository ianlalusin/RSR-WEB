'use client';

import { ColumnDef } from '@tanstack/react-table';
import { UserProfile } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const columns: ColumnDef<UserProfile>[] = [
  {
    accessorKey: 'displayName',
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue('displayName')}</div>
    ),
  },
  {
    accessorKey: 'email',
    header: 'Email',
  },
  {
    accessorKey: 'positionId',
    header: 'Position',
    cell: ({ row }) => {
      const positionId = row.getValue('positionId') as string;
      const positionName =
        positionId === 'platformAdmin'
          ? 'Platform Admin'
          : positionId === 'officeAdmin'
          ? 'Office Admin'
          : 'N/A';
      return (
        <Badge
          variant={positionId === 'platformAdmin' ? 'default' : 'secondary'}
        >
          {positionName}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'isActive',
    header: 'Status',
    cell: ({ row }) => {
      const isActive = row.getValue('isActive');
      return (
        <div
          className={cn(
            'flex items-center gap-2',
            isActive ? 'text-green-600' : 'text-red-600'
          )}
        >
          {isActive ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <span>{isActive ? 'Active' : 'Inactive'}</span>
        </div>
      );
    },
  },
];
