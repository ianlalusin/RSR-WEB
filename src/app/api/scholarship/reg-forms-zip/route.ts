import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'node:stream';
import archiver from 'archiver';
import { assertActor } from '@/lib/server-auth';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { canViewPage } from '@/lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600;

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;

/** Cap concurrent Storage existence checks so we don't fan out 500 calls at once. */
async function filterExisting<T>(items: T[], path: (t: T) => string, bucket: ReturnType<typeof adminStorage.bucket>, limit = 25): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < items.length; i += limit) {
        const chunk = items.slice(i, i + limit);
        const flags = await Promise.all(
            chunk.map(async (t) => {
                try {
                    const [exists] = await bucket.file(path(t)).exists();
                    return exists;
                } catch {
                    return false;
                }
            }),
        );
        chunk.forEach((t, j) => flags[j] && out.push(t));
    }
    return out;
}

export async function GET(req: NextRequest) {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let actor;
    try {
        actor = await assertActor(token);
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!actor.isPlatformAdmin && actor.profile && !canViewPage(actor.profile, 'scholarship_applications')) {
        return NextResponse.json({ error: 'Permission denied.' }, { status: 403 });
    }

    const batchParam = req.nextUrl.searchParams.get('batch');
    const batchNo = batchParam ? parseInt(batchParam, 10) : null;

    try {
        // When filtering by batch, use an equality filter ONLY and sort in memory —
        // mirrors getScholarshipApplications and avoids needing a composite
        // (batchNo + createdAt) index that isn't provisioned.
        const col = adminDb.collection('scholarshipApplications');
        const snap = batchNo && !isNaN(batchNo)
            ? await col.where('batchNo', '==', batchNo).get()
            : await col.orderBy('createdAt', 'desc').get();

        const bucket = adminStorage.bucket(BUCKET);

        const docs = snap.docs
            .filter((d) => !!d.data().registrationForm?.storagePath)
            .sort((a, b) => (b.data().createdAt?.toMillis?.() ?? 0) - (a.data().createdAt?.toMillis?.() ?? 0));

        // Skip files that no longer exist so one missing object can't abort the
        // whole stream (we can't change the HTTP status once streaming starts).
        const present = await filterExisting(docs, (d) => d.data().registrationForm.storagePath, bucket);

        // STREAM the zip: archiver pulls one file at a time from Storage and writes
        // it straight to the response, so peak memory is ~one file — never the whole
        // batch. (The old version buffered every file + the full zip in memory, which
        // OOM-killed the container -> 503 on large batches.) `store` = no compression,
        // since registration forms are already-compressed JPG/PDF.
        const archive = archiver('zip', { store: true });
        archive.on('error', (err) => archive.destroy(err));

        const nameCount = new Map<string, number>();
        for (const doc of present) {
            const r = doc.data();
            const storagePath: string = r.registrationForm.storagePath;
            const contentType: string = r.registrationForm?.contentType ?? '';
            const ext = contentType === 'application/pdf' ? '.pdf' : '.jpg';

            const mi = r.middleName?.trim()
                ? ' ' + r.middleName.trim().charAt(0).toUpperCase() + '.'
                : '';
            const baseName = `${r.lastName ?? ''}, ${r.firstName ?? ''}${mi}`;

            // Deduplicate: Santos, Juan D -> Santos, Juan D (2) on collision.
            const count = (nameCount.get(baseName) ?? 0) + 1;
            nameCount.set(baseName, count);
            const fileName = count === 1 ? `${baseName}${ext}` : `${baseName} (${count})${ext}`;

            archive.append(bucket.file(storagePath).createReadStream(), { name: fileName });
        }
        archive.finalize();

        const stamp = new Date().toISOString().slice(0, 10);
        const suffix = batchNo && !isNaN(batchNo) ? `batch${batchNo}-` : '';
        const body = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;

        return new NextResponse(body, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="reg-forms-${suffix}${stamp}.zip"`,
                'Cache-Control': 'no-store',
            },
        });
    } catch (err: any) {
        console.error('reg-forms-zip error:', err);
        return NextResponse.json(
            { error: err?.message ?? 'Failed to build registration-forms ZIP.' },
            { status: 500 },
        );
    }
}
