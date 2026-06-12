'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ref as storageRef, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertTriangle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderOpen,
  ImageOff,
  Layers,
  Search,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { canViewPage } from '@/lib/access';
import { useToast } from '@/hooks/use-toast';
import { storage } from '@/lib/firebase';
import {
  getScholarshipApplications,
  getScholarshipFormConfig,
  type ScholarshipApplicationListItem,
} from '@/app/actions';

const PAGE_SIZE = 48;

type FileEntry = {
  id: string;
  name: string;
  ref: string;
  storagePath: string;
  contentType: string;
};

/** One registration-form tile — lazily resolves its own download URL (staff Storage reads are allowed). */
function FileCard({ entry }: { entry: FileEntry }) {
  const isImage = (entry.contentType ?? '').startsWith('image/');
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    setErr(false);
    (async () => {
      try {
        const u = await getDownloadURL(storageRef(storage, entry.storagePath));
        if (!cancelled) setUrl(u);
      } catch {
        if (!cancelled) setErr(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entry.storagePath]);

  return (
    <button
      type="button"
      onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
      disabled={!url}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition hover:border-primary/50 hover:shadow-md disabled:cursor-default"
      title={`${entry.name} — open in new tab`}
    >
      <div className="relative flex h-36 items-center justify-center overflow-hidden bg-muted">
        {isImage ? (
          err ? (
            <ImageOff className="h-10 w-10 text-muted-foreground" />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={entry.name}
              loading="lazy"
              className="h-full w-full object-cover transition group-hover:scale-[1.03]"
            />
          ) : (
            <Skeleton className="h-full w-full" />
          )
        ) : (
          <FileText className="h-12 w-12 text-muted-foreground" />
        )}
        <span className="absolute right-1.5 top-1.5 rounded bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {isImage ? 'IMG' : 'PDF'}
        </span>
      </div>
      <div className="space-y-0.5 p-2">
        <p className="truncate text-sm font-medium">{entry.name}</p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{entry.ref}</p>
      </div>
    </button>
  );
}

export default function ScholarshipFilesPage() {
  const { user, userProfile, isPlatformAdminClaim } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<ScholarshipApplicationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentBatch, setCurrentBatch] = useState(1);
  const [selectedBatch, setSelectedBatch] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);

  const canView = canViewPage(userProfile, 'scholarship_applications', { isPlatformAdminClaim });

  const availableBatches = useMemo(
    () => Array.from({ length: currentBatch }, (_, i) => i + 1),
    [currentBatch],
  );

  const loadConfig = useCallback(async () => {
    if (!user || !canView) return;
    try {
      const token = await user.getIdToken();
      const res = await getScholarshipFormConfig(token);
      if (res.success) {
        const cb = res.config.currentBatch ?? 1;
        setCurrentBatch(cb);
        setSelectedBatch((prev) => (prev == null ? cb : prev));
      }
    } catch {
      setSelectedBatch((prev) => (prev == null ? 1 : prev));
    }
  }, [user, canView]);

  const reload = useCallback(async () => {
    if (!user || !canView || selectedBatch == null) return;
    setLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await getScholarshipApplications(token, selectedBatch);
      if (!res.success) {
        toast({ variant: 'destructive', title: 'Failed to load files', description: res.error });
        setItems([]);
      } else {
        setItems(res.data);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed to load files', description: err?.message });
    } finally {
      setLoading(false);
    }
  }, [user, canView, toast, selectedBatch]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (selectedBatch != null) reload();
  }, [selectedBatch, reload]);

  // Reset to the first page whenever the view changes.
  useEffect(() => {
    setPage(0);
  }, [selectedBatch, query]);

  const allEntries = useMemo<FileEntry[]>(() => {
    return items
      .map((a) => {
        const file = a.registrationForm;
        if (!file?.storagePath) return null;
        return {
          id: a.id,
          name: [a.lastName, a.firstName].filter(Boolean).join(', '),
          ref: a.referenceNo,
          storagePath: file.storagePath,
          contentType: file.contentType ?? '',
        } as FileEntry;
      })
      .filter((e): e is FileEntry => e !== null);
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allEntries;
    return allEntries.filter((e) => e.name.toLowerCase().includes(q) || e.ref.toLowerCase().includes(q));
  }, [allEntries, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="text-destructive" /> Access Denied
          </CardTitle>
          <CardDescription>You do not have access to scholarship files.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-1 h-7 text-muted-foreground">
            <Link href="/educational/ched">
              <ArrowLeft className="mr-1 h-4 w-4" /> CHED Tulong Dunong
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FolderOpen className="h-6 w-6 text-primary" /> Registration Forms
          </h1>
          <p className="text-muted-foreground">Browse the registration forms applicants uploaded. Click any tile to open it.</p>
        </div>
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <Select
            value={selectedBatch != null ? String(selectedBatch) : undefined}
            onValueChange={(v) => setSelectedBatch(Number(v))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select batch" />
            </SelectTrigger>
            <SelectContent>
              {availableBatches.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n === currentBatch ? `Batch ${n} (current)` : `Batch ${n}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-end">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name or reference no…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-[200px] w-full rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <FolderOpen className="h-10 w-10" />
            <p className="font-medium">No files to show</p>
            <p className="text-sm">
              {allEntries.length === 0
                ? 'No registration forms uploaded in this batch.'
                : 'No files match your search.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing <span className="font-medium text-foreground">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</span> of{' '}
              <span className="font-medium text-foreground">{filtered.length}</span> form(s)
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-1 text-xs">
                  {page + 1} / {totalPages}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {pageItems.map((entry) => (
              <FileCard key={`${entry.id}-${entry.storagePath}`} entry={entry} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
