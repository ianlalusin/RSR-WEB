'use client';

import { ColumnDef } from '@tanstack/react-table';
import { Barangay } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, MoreHorizontal, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { useAuth } from '@/components/providers/auth-provider';
import { canDelete, canWriteBarangay } from '@/lib/permissions';
import DeleteBrgyAlert from './_components/delete-brgy-alert';
import BrgyFormDialog from './_components/brgy-form-dialog';

export const columns: ColumnDef<Barangay>[] = [
  {
    accessorKey: 'name',
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
    cell: ({ row }) => {
        const barangay = row.original;
        return (
            <Link href={`/barangays/${barangay.id}`} className="hover:underline">
                {barangay.name}
            </Link>
        )
    }
  },
  {
    accessorKey: 'districtName',
    header: 'District',
  },
  {
    accessorKey: 'population',
    header: 'Population',
    cell: ({ row }) => {
        const amount = parseFloat(row.getValue('population'))
        return <div className="text-right font-medium">{amount.toLocaleString()}</div>
      },
  },
  {
    accessorKey: 'votingPopulation',
    header: 'Voters',
    cell: ({ row }) => {
        const amount = parseFloat(row.getValue('votingPopulation'))
        return <div className="text-right font-medium">{amount.toLocaleString()}</div>
      },
  },
  {
    accessorKey: 'rsrVotes',
    header: 'RSR Votes',
    cell: ({ row }) => {
        const amount = parseFloat(row.getValue('rsrVotes'))
        return <div className="text-right font-medium">{amount.toLocaleString()}</div>
    }
  },
  {
    accessorKey: 'favoredVotePct',
    header: 'Favored Vote %',
    cell: ({ row }) => {
        const percentage = parseFloat(row.getValue('favoredVotePct'));
        return <div className="text-right font-medium">{percentage.toFixed(1)}%</div>
    }
  },
  {
    accessorKey: 'isWin',
    header: 'Status',
    cell: ({ row }) => {
      const isWin = row.getValue('isWin');
      return (
        <Badge variant={isWin ? 'default' : 'secondary'} className={isWin ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'}>
          {isWin ? 'Win' : 'Lose'}
        </Badge>
      );
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const barangay = row.original;
      const { userProfile } = useAuth();
      const canDel = canDelete(userProfile);
      const canEdit = canWriteBarangay(userProfile);

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
            <Link href={`/barangays/${barangay.id}`} passHref>
                <DropdownMenuItem>View Details</DropdownMenuItem>
            </Link>
            {canEdit && (
                <BrgyFormDialog barangay={barangay}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                </BrgyFormDialog>
            )}
            {canDel && (
                <>
                    <DropdownMenuSeparator />
                    <DeleteBrgyAlert barangayId={barangay.id} barangayName={barangay.name}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DeleteBrgyAlert>
                </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
