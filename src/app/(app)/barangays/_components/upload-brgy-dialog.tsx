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
import type { Barangay } from '@/lib/types';
import { Loader2, UploadCloud } from 'lucide-react';
import { bulkAddBarangays } from '@/app/actions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';

type UploadedBrgy = Omit<Barangay, 'id' | 'createdAt' | 'updatedAt'>;

const mapRowToBarangay = (row: any): UploadedBrgy | null => {
    // Check for required fields
    if (!row['Brgy Name'] || !row['District'] || !row['Population'] || !row['Voting Population'] || row['RSR Vote'] === undefined) {
        return null;
    }
    
    const votingPopulation = Number(row['Voting Population']);
    const rsrVote = Number(row['RSR Vote']);

    const favoredVotePct = votingPopulation > 0 ? (rsrVote / votingPopulation) * 100 : 0;

    return {
        name: String(row['Brgy Name']),
        districtName: String(row['District']),
        districtId: String(row['District']).toLowerCase().replace(/\s/g, '-'),
        population: Number(row['Population']),
        votingPopulation: votingPopulation,
        favoredVotePct: favoredVotePct,
        isWin: String(row['Result']).toLowerCase() === 'win',
        congVisitCount: 0,
        coordinatorUids: [],
    };
}


export default function UploadBrgyDialog({ onSuccess }: { onSuccess?: () => void; }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parsedData, setParsedData] = useState<UploadedBrgy[]>([]);
  const [fileName, setFileName] = useState('');
  const { toast } = useToast();

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
            
            const mappedData = json.map(mapRowToBarangay).filter((d): d is UploadedBrgy => d !== null);

            if(mappedData.length === 0) {
                toast({
                    variant: 'destructive',
                    title: 'Parsing Error',
                    description: 'Could not parse any valid barangay data from the file. Please check column names.',
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
      toast({
        variant: 'destructive',
        title: 'No Data',
        description: 'No data to upload. Please select and parse a file first.',
      });
      return;
    }

    setIsUploading(true);
    try {
      const result = await bulkAddBarangays(parsedData);
      if (result.success) {
        toast({
          title: 'Upload Successful',
          description: `${parsedData.length} barangays have been added to the database.`,
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
        description: error.message || 'An unknown error occurred during the upload.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const tableHeaders = parsedData.length > 0 ? Object.keys(parsedData[0]) : [];

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
            Select an Excel file (.xlsx, .xls, .csv) with barangay data to bulk upload.
            Ensure columns match: Brgy Name, District, Population, Voting Population, RSR Vote, and Result.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            <Input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
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
                            {parsedData.slice(0, 20).map((row, index) => (
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
