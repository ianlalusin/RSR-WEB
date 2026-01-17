import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Coordinator } from '@/lib/types';
import { mockCoordinators } from '@/lib/data';
import { DataTable } from './data-table';
import { columns } from './columns';

async function getCoordinators(): Promise<Coordinator[]> {
  // In a real app, you would fetch this from Firestore
  return mockCoordinators;
}

export default async function CoordinatorsPage() {
  const data = await getCoordinators();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coordinators</CardTitle>
        <CardDescription>
          A list of all coordinators in the system.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={data} />
      </CardContent>
    </Card>
  );
}
