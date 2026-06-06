'use client';

import { useMemo, useState } from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ScholarshipApplicationListItem } from '@/app/actions';

interface DataTableProps {
  columns: ColumnDef<ScholarshipApplicationListItem, any>[];
  data: ScholarshipApplicationListItem[];
  onRowClick: (item: ScholarshipApplicationListItem) => void;
  rightSlot?: React.ReactNode;
}

export function DataTable({ columns, data, onRowClick, rightSlot }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue ?? '').toLowerCase().trim();
      if (!q) return true;
      const r = row.original;
      return (
        r.referenceNo.toLowerCase().includes(q) ||
        r.lastName.toLowerCase().includes(q) ||
        r.firstName.toLowerCase().includes(q) ||
        r.school.toLowerCase().includes(q) ||
        r.course.toLowerCase().includes(q) ||
        r.city.toLowerCase().includes(q)
      );
    },
  });

  const filterValue = useMemo(() => {
    const f = columnFilters.find((c) => c.id === 'isShortlisted')?.value;
    return (f as string) ?? 'all';
  }, [columnFilters]);

  const setShortlistFilter = (value: string) => {
    setColumnFilters((prev) => {
      const others = prev.filter((c) => c.id !== 'isShortlisted');
      if (value === 'all') return others;
      return [...others, { id: 'isShortlisted', value }];
    });
  };

  return (
    <div>
      <div className="flex flex-col items-stretch gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search name, school, course, city, ref no..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Select value={filterValue} onValueChange={setShortlistFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All applications</SelectItem>
              <SelectItem value="shortlisted">Shortlisted only</SelectItem>
              <SelectItem value="not_shortlisted">Not shortlisted only</SelectItem>
            </SelectContent>
          </Select>
          {rightSlot}
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => onRowClick(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No applications found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="text-xs text-muted-foreground">
          Showing {table.getRowModel().rows.length} of {data.length} applications
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
