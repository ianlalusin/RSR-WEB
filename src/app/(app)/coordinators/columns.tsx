'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Coordinator } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { differenceInYears } from 'date-fns';
import { cn } from '@/lib/utils';

export const columns: ColumnDef<Coordinator>[] = [
  {
    accessorKey: 'employmentId',
    header: 'Emp. ID',
  },
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    header: 'Age',
    cell: ({ row }) => {
        const birthday = row.original.birthday;
        if (!birthday) return 'N/A';
        // Firestore Timestamps can be converted with .toDate()
        const birthDate = (birthday as any).toDate ? (birthday as any).toDate() : new Date(birthday as any);
        return differenceInYears(new Date(), birthDate);
    }
  },
  {
    accessorKey: 'departmentId',
    header: 'Department',
  },
  {
    accessorKey: 'role',
    header: 'Role',
  },
  {
    accessorKey: 'contact',
    header: 'Contact No.',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string;
      const variant: "default" | "secondary" | "outline" = 
        status === 'active' ? 'default'
        : status === 'on_leave' ? 'secondary'
        : 'outline';
      const className = 
        status === 'active' ? 'bg-green-100 text-green-800'
        : status === 'on_leave' ? 'bg-yellow-100 text-yellow-800'
        : status === 'inactive' ? 'bg-red-100 text-red-800' : '';

      return (
        <Badge variant={variant} className={cn('capitalize', className)}>
          {status.replace(/_/g, ' ')}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
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
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Edit Member</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
