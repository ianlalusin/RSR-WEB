'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isValid, parseISO } from 'date-fns';
import type { ScholarshipApplicationListItem } from '@/app/actions';

function formatDate(iso: string | null): string {
  if (!iso) return 'N/A';
  const d = parseISO(iso);
  if (!isValid(d)) return 'N/A';
  return format(d, 'PPp');
}

export const columns: ColumnDef<ScholarshipApplicationListItem>[] = [
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Submitted <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => formatDate(row.original.createdAt),
    sortingFn: (a, b) => {
      const av = a.original.createdAt ?? '';
      const bv = b.original.createdAt ?? '';
      return av < bv ? -1 : av > bv ? 1 : 0;
    },
  },
  {
    accessorKey: 'referenceNo',
    header: 'Reference No.',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.referenceNo}</span>,
  },
  {
    id: 'name',
    accessorFn: (row) => `${row.lastName}, ${row.firstName}`,
    header: ({ column }) => (
      <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
        Name <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
    cell: ({ row }) => `${row.original.lastName}, ${row.original.firstName}`,
  },
  {
    accessorKey: 'city',
    header: 'City',
  },
  {
    accessorKey: 'school',
    header: 'School',
    cell: ({ row }) => <span className="line-clamp-2 max-w-[18rem]">{row.original.school}</span>,
  },
  {
    accessorKey: 'course',
    header: 'Course',
    cell: ({ row }) => <span className="line-clamp-2 max-w-[18rem]">{row.original.course}</span>,
  },
  {
    accessorKey: 'yearLevel',
    header: 'Year Level',
  },
  {
    accessorKey: 'isShortlisted',
    header: 'Shortlisted',
    cell: ({ row }) =>
      row.original.isShortlisted ? (
        <Badge className="bg-green-600 text-white hover:bg-green-700">YES</Badge>
      ) : (
        <Badge variant="secondary">NO</Badge>
      ),
    filterFn: (row, _columnId, value) => {
      if (value === 'all' || value === undefined || value === null) return true;
      if (value === 'shortlisted') return row.original.isShortlisted === true;
      if (value === 'not_shortlisted') return row.original.isShortlisted !== true;
      return true;
    },
  },
];
