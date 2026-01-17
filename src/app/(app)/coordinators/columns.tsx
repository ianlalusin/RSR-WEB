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

export const columns: ColumnDef<Coordinator>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'contact',
    header: 'Contact Info',
  },
  {
    accessorKey: 'districtId',
    header: 'District',
  },
  {
    accessorKey: 'assignedBrgyIds',
    header: 'Assigned Brgys',
    cell: ({ row }) => {
        const brgys: string[] = row.getValue('assignedBrgyIds');
        return brgys.length;
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status');
      const isActive = status === 'active';
      return (
        <Badge variant={isActive ? 'default' : 'outline'} className={isActive ? 'bg-green-100 text-green-800' : ''}>
          {isActive ? 'Active' : 'Inactive'}
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
            <DropdownMenuItem>Edit Coordinator</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
