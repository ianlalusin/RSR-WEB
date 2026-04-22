
'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Hospital } from '@/lib/types';
import { MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import HospitalFormDialog from './_components/hospital-form-dialog';
import DeleteHospitalAlert from './_components/delete-hospital-alert';

type GetColumnsProps = {
  canUpdate: boolean;
  canDelete: boolean;
};

export const getHospitalColumns = ({ canUpdate, canDelete }: GetColumnsProps): ColumnDef<Hospital>[] => [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'address',
    header: 'Address',
     cell: ({ row }) => row.original.address || <span className="text-muted-foreground">N/A</span>,
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const hospital = row.original;
      
      const showActions = canUpdate || canDelete;
      if (!showActions) return null;

      return (
        <div className="text-right">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {canUpdate && (
                    <HospitalFormDialog hospital={hospital}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                    </HospitalFormDialog>
                )}
                {canDelete && (
                    <>
                        <DropdownMenuSeparator />
                        <DeleteHospitalAlert hospital={hospital}>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </DropdownMenuItem>
                        </DeleteHospitalAlert>
                    </>
                )}
            </DropdownMenuContent>
            </DropdownMenu>
        </div>
      );
    },
  },
];
