'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud } from 'lucide-react';
import { bulkAddBarangays, type AddBarangayInput } from '@/app/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/components/providers/auth-provider';
import { Label } from '@/components/ui/label';

const DEFAULT_CYCLE_YEAR = String(new Date().getFullYear());

type UploadedBrgy = AddBarangayInput;

const mapRowToBarangay = (row: any, fallbackYear: string): UploadedBrgy | null => {
    const getValue = (key: string) => {
        const foundKey = Object.keys(row).find(k => k.toLowerCase().trim() === key.toLowerCase().trim());
        return foundKey ? row[foundKey] : undefined;
    };

    const brgyName = getValue('Brgy Name');
    const district = getValue('District');
    const result = getValue('Result');
    const yearCell = getValue('Election Year');

    const population = Number(getValue('Population'));
    const votingPopulation = Number(getValue('Voting Population'));
    const rsrVotes = Number(getValue('RSR Votes'));

    if (!brgyName || !district || isNaN(population) || isNaN(votingPopulation) || isNaN(rsrVotes)) {
        return null;
    }

    const favoredVotePct = votingPopulation > 0 ? (rsrVotes / votingPopulation) * 100 : 0;
    const yearStr = yearCell ? String(yearCell).trim() : fallbackYear;
    const cycleYear = /^\d{4}$/.test(yearStr) ? yearStr : fallbackYear;

    return {
        name: String(brgyName),
        districtName: String(district),
        districtId: String(district).toLowerCase().replace(/\s/g, '-'),
        population,
        congVisitCount: 0,
        coordinatorUids: [],
        cycleYear,
        cycleStats: {
            votingPopulation,
            rsrVotes,
            favoredVotePct,
            isWin: result ? String(result).toLowerCase() === 'win' : false,
        },
    };
}


export default function UploadBrgyDialog({ onSuccess }: { onSuccess?: () => void; }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<UploadedBrgy[]>([]);
  const [fileName, setFileName] = useState('');
  const [fallbackYear, setFallbackYear] = useState(DEFAULT_CYCLE_YEAR);
  const { toast } = useToast();
  const { user, userProfile } = useAuth();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'binary' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet);

            const mappedData = json
                .map(row => mapRowToBarangay(row, fallbackYear))
                .filter((d): d is UploadedBrgy => d !== null);

            if(mappedData.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Parsing Error',
                    description: 'Could not parse any valid barangay data. Check column names: Brgy Name, District, Population, Voting Population, RSR Votes, Result.',
                });
                return;
            }

            setParsedData(mappedData);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'File Read Error',
                description: error.message || 'Failed to read or parse the Excel file.',
            });
        }
    };

    reader.onerror = () => {
        toast({
            variant: 'destructive',
            title: 'File Read Error',
            description: 'Could not read the selected file.',
        });
    }

    reader.readAsBinaryString(file);
  };

  const handleUpload = async () => {
    if (parsedData.length === 0) {
      toast({ variant: 'destructive', title: 'No Data', description: 'No data to upload.' });
      return;
    }
    if (!userProfile) {
        toast({ variant: 'destructive', title: 'Not authenticated' });
        return;
    }
    const actorToken = await user!.getIdToken();

    setIsUploading(true);
    try {
      const result = await bulkAddBarangays(parsedData, actorToken);
      if (result.success) {
        toast({
          title: 'Upload Successful',
          description: `${parsedData.length} barangays have been added.`,
        });
        setIsOpen(false);
        setParsedData([]);
        setFileName('');
        onSuccess?.();
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload Failed',
        description: error.message || 'An unknown error occurred.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const previewRows = parsedData.map(row => ({
      name: row.name,
      districtName: row.districtName,
      population: row.population,
      cycleYear: row.cycleYear,
      votingPopulation: row.cycleStats.votingPopulation,
      rsrVotes: row.cycleStats.rsrVotes,
      favoredVotePct: row.cycleStats.favoredVotePct.toFixed(1),
      isWin: row.cycleStats.isWin ? 'Win' : 'Lose',
  }));
  const tableHeaders = previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) {
            setParsedData([]);
            setFileName('');
        }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline">
            <UploadCloud className="mr-2 h-4 w-4" />
            Upload Excel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Upload Barangay Data</DialogTitle>
          <DialogDescription>
            Select an Excel file (.xlsx, .xls, .csv). Columns: Brgy Name, District, Population, Voting Population, RSR Votes, Result. Optional column "Election Year" assigns the row to a specific cycle; rows without it use the fallback year below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <div className="flex items-end gap-3">
                <div className="flex-1">
                    <Label htmlFor="upload-file">File</Label>
                    <Input id="upload-file" type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
                </div>
                <div className="w-32">
                    <Label htmlFor="fallback-year">Fallback Year</Label>
                    <Input
                        id="fallback-year"
                        value={fallbackYear}
                        onChange={(e) => setFallbackYear(e.target.value.trim())}
                        placeholder="2025"
                        maxLength={4}
                    />
                </div>
            </div>
            {fileName && <p className="text-sm text-muted-foreground">Selected file: {fileName}</p>}
        </div>

        {parsedData.length > 0 && (
            <>
                <p className="text-sm font-medium">Data Preview ({parsedData.length} rows found)</p>
                <ScrollArea className="h-[40vh] mt-2 rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {tableHeaders.map(header => <TableHead key={header} className="capitalize">{header.replace(/([A-Z])/g, ' $1')}</TableHead>)}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {previewRows.slice(0, 20).map((row, index) => (
                                <TableRow key={index}>
                                    {tableHeaders.map(header => (
                                        <TableCell key={header}>
                                            {String((row as any)[header])}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    {parsedData.length > 20 && <p className="p-4 text-sm text-center text-muted-foreground">...and {parsedData.length - 20} more rows.</p>}
                </ScrollArea>
            </>
        )}

        <DialogFooter>
            <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={isUploading}>Cancel</Button>
            </DialogClose>
            <Button onClick={handleUpload} disabled={isUploading || parsedData.length === 0}>
                {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : 'Upload Data'}
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
