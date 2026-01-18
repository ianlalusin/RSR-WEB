'use client';

import { ColumnDef } from '@tanstack/react-table';
import { AssistanceRecord } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
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
import { format } from 'date-fns';
import DeleteAssistanceAlert from './delete-assistance-alert';
import AssistanceFormDialog from './assistance-form-dialog';


export const getAssistanceColumns = ({ canWrite }: { canWrite: boolean }): ColumnDef<AssistanceRecord>[] => [
  {
    accessorKey: 'title',
    header: 'Title',
  },
  {
    accessorKey: 'eventDate',
    header: 'Event Date',
    cell: ({ row }) => {
        const date = row.getValue('eventDate') as any;
        return date ? format(date.toDate(), 'PPP') : 'N/A';
    }
  },
  {
    accessorKey: 'beneficiaryCount',
    header: 'Beneficiaries',
    cell: ({ row }) => {
        const amount = parseFloat(row.getValue('beneficiaryCount'))
        return <div className="text-right font-medium">{amount.toLocaleString()}</div>
      },
  },
  {
    accessorKey: 'valueAmount',
    header: 'Value (PHP)',
    cell: ({ row }) => {
        const amount = parseFloat(row.getValue('valueAmount'))
        return <div className="text-right font-medium">{amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status: string = row.getValue('status');
      return <Badge variant="secondary" className="capitalize">{status}</Badge>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const record = row.original;

      if (!canWrite) return null;

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
            <AssistanceFormDialog record={record} barangay={record as any} sector={record.sector}>
                 <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                </DropdownMenuItem>
            </AssistanceFormDialog>
            <DropdownMenuSeparator />
            <DeleteAssistanceAlert record={record}>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                </DropdownMenuItem>
            </DeleteAssistanceAlert>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
