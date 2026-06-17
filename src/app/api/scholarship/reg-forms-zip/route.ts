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
const DOWNLOAD_CONCURRENCY = 8;

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

        // Stream the zip to the response so we never hold the whole archive in memory.
        // IMPORTANT: feed archiver from fully-downloaded BUFFERS (download() resolves or
        // rejects cleanly), NOT from piped Storage read streams — piping lazy read
        // streams stalls partway and aborts the archive, producing a truncated zip with
        // no central directory (extracts as "empty"). `store` = no compression since
        // forms are already-compressed JPG/PDF.
        const archive = archiver('zip', { store: true });
        archive.on('error', (err) => console.error('reg-forms-zip archive error:', err));

        const stamp = new Date().toISOString().slice(0, 10);
        const suffix = batchNo && !isNaN(batchNo) ? `batch${batchNo}-` : '';
        const body = Readable.toWeb(archive) as unknown as ReadableStream<Uint8Array>;

        const response = new NextResponse(body, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="reg-forms-${suffix}${stamp}.zip"`,
                'Cache-Control': 'no-store',
            },
        });

        // Drive the archive after the response is wired up. Download files in ordered
        // chunks (bounded concurrency for speed), append each buffer, then finalize so
        // the central directory is always written.
        (async () => {
            try {
                const nameCount = new Map<string, number>();
                for (let i = 0; i < docs.length; i += DOWNLOAD_CONCURRENCY) {
                    const group = docs.slice(i, i + DOWNLOAD_CONCURRENCY);
                    const fetched = await Promise.all(
                        group.map(async (doc) => {
                            const r = doc.data();
                            try {
                                const [buf] = await bucket.file(r.registrationForm.storagePath).download();
                                return { r, buf };
                            } catch {
                                // Skip a missing/unreadable object rather than aborting the zip.
                                return null;
                            }
                        }),
                    );
                    for (const item of fetched) {
                        if (!item) continue;
                        const { r, buf } = item;
                        const contentType: string = r.registrationForm?.contentType ?? '';
                        const ext = contentType === 'application/pdf' ? '.pdf' : '.jpg';
                        const mi = r.middleName?.trim()
                            ? ' ' + r.middleName.trim().charAt(0).toUpperCase() + '.'
                            : '';
                        const baseName = `${r.lastName ?? ''}, ${r.firstName ?? ''}${mi}`;
                        const count = (nameCount.get(baseName) ?? 0) + 1;
                        nameCount.set(baseName, count);
                        const fileName = count === 1 ? `${baseName}${ext}` : `${baseName} (${count})${ext}`;
                        archive.append(buf, { name: fileName });
                    }
                }
                await archive.finalize();
            } catch (err) {
                console.error('reg-forms-zip build error:', err);
                archive.abort();
            }
        })();

        return response;
    } catch (err: any) {
        console.error('reg-forms-zip error:', err);
        return NextResponse.json(
            { error: err?.message ?? 'Failed to build registration-forms ZIP.' },
            { status: 500 },
        );
    }
}
