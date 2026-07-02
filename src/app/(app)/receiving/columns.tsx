'use client';

import { ColumnDef } from '@tanstack/react-table';
import { RequestRecord } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

const SECTOR_LABELS: Record<string, string> = {
  medical: 'Medical',
  educational: 'Educational',
  infrastructure: 'Infrastructure',
};

const SUB_CATEGORY_LABELS: Record<string, string> = {
  medical_assistance: 'Medical Assistance',
  accredited_hospitals: 'Accredited Hospitals',
  financial_standing: 'Financial Standing',
  ched_tulong_dunong: 'CHED Tulong Dunong',
  cong_scholarship: 'Cong Scholarship',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  under_review: 'bg-sky-100 text-sky-800 border-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-800 border-rose-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
};

function formatDate(ts: unknown) {
  if (!ts) return '-';
  let date: Date;
  if (ts instanceof Timestamp) {
    date = ts.toDate();
  } else if (ts instanceof Date) {
    date = ts;
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    date = new Date(ts);
  } else if (typeof ts === 'object' && typeof (ts as { seconds?: unknown }).seconds === 'number') {
    // Serialized Firestore Timestamp map, e.g. {type, seconds, nanoseconds}
    date = new Date((ts as { seconds: number }).seconds * 1000);
  } else {
    return '-';
  }
  return isNaN(date.getTime()) ? '-' : format(date, 'MMM d, yyyy');
}

export const columns: ColumnDef<RequestRecord>[] = [
  {
    accessorKey: 'resoTitle',
    header: 'Reso Title',
    cell: ({ row }) => (
      <div className="max-w-[200px]">
        <p className="font-medium truncate">{row.original.resoTitle}</p>
        {row.original.resoNumber && (
          <p className="text-xs text-muted-foreground">{row.original.resoNumber}</p>
        )}
      </div>
    ),
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
    accessorKey: 'proponents',
    header: 'Proponents',
    cell: ({ row }) => (
      <span className="max-w-[150px] truncate block">{row.original.proponents}</span>
    ),
  },
  {
    accessorKey: 'sector',
    header: 'Sector',
    cell: ({ row }) => (
      <Badge variant="outline">{SECTOR_LABELS[row.original.sector] || row.original.sector}</Badge>
    ),
  },
  {
    accessorKey: 'subCategory',
    header: 'Category',
    cell: ({ row }) => {
      const sub = row.original.subCategory;
      if (!sub) return '-';
      return <span className="text-sm">{SUB_CATEGORY_LABELS[sub] || sub}</span>;
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const s = row.original.status;
      return (
        <Badge variant="outline" className={STATUS_STYLES[s] || ''}>
          {STATUS_LABELS[s] || s}
        </Badge>
      );
    },
    filterFn: (row, id, value) => {
      if (!value || value === 'all') return true;
      return row.getValue(id) === value;
    },
  },
  {
    accessorKey: 'dateReceived',
    header: 'Date Received',
    cell: ({ row }) => formatDate(row.original.dateReceived),
  },
];
