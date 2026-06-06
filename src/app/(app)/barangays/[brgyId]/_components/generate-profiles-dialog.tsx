'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { generateBarangayProfiles } from '@/app/actions';
import type { Barangay, GeneratedProfile } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/components/providers/auth-provider';

interface Props {
  barangay: Barangay;
  canGenerate: boolean;
}

export default function GenerateProfilesDialog({ barangay, canGenerate }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<GeneratedProfile[] | null>(null);
  const { toast } = useToast();
  const { user, userProfile } = useAuth();

  const handleGeneration = async () => {
    if (!userProfile) return;

    setIsLoading(true);
    setError(null);
    setProfiles(null);

    const input = {
      barangayName: barangay.name,
      districtName: barangay.districtName,
      population: barangay.population,
      votingPopulation: barangay.currentStats?.votingPopulation ?? barangay.votingPopulation ?? 0,
      favoredVotePct: barangay.currentStats?.favoredVotePct ?? barangay.favoredVotePct ?? 0,
    };

    const result = await generateBarangayProfiles(input, await user!.getIdToken());

    if (result.success && result.data) {
      setProfiles(result.data as GeneratedProfile[]);
      toast({
        title: 'Profiles Generated',
        description: `Successfully generated ${result.data.length} resident profiles.`,
      });
    } else {
      setError(result.error ?? null);
    }

    setIsLoading(false);
  };

  const getTableHeaders = () => {
    if (!profiles || profiles.length === 0) return [];
    return Object.keys(profiles[0]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!canGenerate}>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate Resident Profiles
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Generate Representative Resident Profiles</DialogTitle>
          <DialogDescription>
            Use AI to generate realistic profiles for residents of {barangay.name} based on its demographic data.
          </DialogDescription>
        </DialogHeader>
        
        {!profiles && !isLoading && !error && (
            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg">
                <Sparkles className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Ready to generate profiles?</h3>
                <p className="text-sm text-muted-foreground mb-4">Click the button below to start the AI generation process.</p>
                <Button onClick={handleGeneration}>Generate Profiles</Button>
            </div>
        )}

        {isLoading && (
            <div className="space-y-4 p-4">
                <Skeleton className="h-8 w-1/3" />
                <div className="space-y-2">
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-5/6" />
                </div>
            </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Generation Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {profiles && (
          <ScrollArea className="h-[50vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  {getTableHeaders().map((header) => (
                    <TableHead key={header} className="capitalize">{header.replace(/([A-Z])/g, ' $1')}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {profiles.map((profile, index) => (
                  <TableRow key={index}>
                    {Object.values(profile).map((value, i) => (
                      <TableCell key={i}>{typeof value === 'boolean' ? String(value) : value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
        <DialogFooter>
            {profiles && (
                 <Button onClick={handleGeneration} disabled={isLoading}>
                    {isLoading ? "Regenerating..." : "Regenerate"}
                 </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
