import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Barangay } from '@/lib/types';
import { mockBarangays } from '@/lib/data';
import { DataTable } from './data-table';
import { columns } from './columns';

async function getBarangays(): Promise<Barangay[]> {
  // In a real app, you would fetch this from Firestore
  return mockBarangays;
}

export default async function BarangaysPage() {
  const data = await getBarangays();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Barangays</CardTitle>
        <CardDescription>
          A list of all barangays in the system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={data} />
      </CardContent>
    </Card>
  );
}
