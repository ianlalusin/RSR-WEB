'use client';

import { ColumnDef } from '@tanstack/react-table';
import { MedicalRecord } from '@/lib/types';
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
import { useAuth } from '@/components/providers/auth-provider';
import { canDo } from '@/lib/access';
import { format } from 'date-fns';
import DeleteMedicalAlert from './_components/delete-medical-alert';
import MedicalFormDialog from './_components/medical-form-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const columns: ColumnDef<MedicalRecord>[] = [
  {
    accessorKey: 'projectId',
    header: 'Project ID',
  },
  {
    accessorKey: 'projectType',
    header: 'Project Type',
    cell: ({ row }) => {
      const type = row.getValue('projectType') as string;
      return <Badge variant="secondary" className="capitalize">{type.replace('_', ' ')}</Badge>;
    }
  },
  {
    accessorKey: 'districtName',
    header: 'District',
  },
  {
    accessorKey: 'brgyName',
    header: 'Barangay',
  },
  {
    accessorKey: 'fullName',
    header: 'Beneficiary/Title',
    cell: ({ row }) => {
      const record = row.original;
      return record.projectType === 'medical_assistance' ? record.fullName : record.title;
    },
  },
   {
    accessorKey: 'assistanceType',
    header: 'Assistance Type',
    cell: ({ row }) => {
      const record = row.original;
      if (record.projectType === 'medical_drive') return <span className="text-muted-foreground">N/A</span>;
      return <span className="capitalize">{record.assistanceType}</span>;
    },
  },
   {
    accessorKey: 'eventDate',
    header: 'Event Date',
    cell: ({ row }) => {
      const date = row.getValue('eventDate') as any;
      return date ? format(date.toDate(), 'PPP') : 'N/A';
    },
  },
  {
    accessorKey: 'referralDetails',
    header: 'Coordinator',
    cell: ({ row }) => {
        const details = row.original.referralDetails;
        if (!details) return <span className="text-muted-foreground">N/A</span>;
        
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className="underline cursor-pointer">{details.coordinatorName}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Referred: {format(details.dateReferred.toDate(), 'PPP')}</p>
                        <p>Approved: {format(details.dateApproved.toDate(), 'PPP')}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const record = row.original;
      const { userProfile } = useAuth();
      const canDel = canDo(userProfile, 'projects_medical', 'delete');
      const canEdit = canDo(userProfile, 'projects_medical', 'update');

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem>View Details</DropdownMenuItem>
            {canEdit && (
                <MedicalFormDialog record={record}>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                    </DropdownMenuItem>
                </MedicalFormDialog>
            )}
            {canDel && (
                <>
                    <DropdownMenuSeparator />
                    <DeleteMedicalAlert recordId={record.id} recordName={record.projectId}>
                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DeleteMedicalAlert>
                </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
