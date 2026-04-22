'use client';

import { ReactNode, useState } from 'react';
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
  ColumnFiltersState,
  SortingState,
  getSortedRowModel,
} from '@tanstack/react-table';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filterColumn?: string;
  filterPlaceholder?: string;
  toolbarChildren?: ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filterColumn = 'resoTitle',
  filterPlaceholder = 'Search reso title...',
  toolbarChildren,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'dateReceived', desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, columnFilters },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sky-700" />
          <Input
            placeholder={filterPlaceholder}
            value={(table.getColumn(filterColumn)?.getFilterValue() as string) ?? ''}
            onChange={(e) => table.getColumn(filterColumn)?.setFilterValue(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">{toolbarChildren}</div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-sky-100">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-sky-100">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="text-black font-semibold">
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="text-black">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="text-black">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-black">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between gap-2 py-4">
        <p className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} entr{table.getFilteredRowModel().rows.length === 1 ? 'y' : 'ies'}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
