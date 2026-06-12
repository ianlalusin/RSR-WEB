import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { assertActor } from '@/lib/server-auth';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { canViewPage } from '@/lib/access';

const BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!;

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

    const snap = await adminDb.collection('scholarshipApplications').orderBy('createdAt', 'desc').get();

    const bucket = adminStorage.bucket(BUCKET);
    const zip = new JSZip();

    // Track filenames to handle duplicates (same full name).
    const nameCount = new Map<string, number>();

    // Download files in parallel with a concurrency cap of 10.
    const docs = snap.docs.filter((d) => !!d.data().registrationForm?.storagePath);

    const CONCURRENCY = 10;
    for (let i = 0; i < docs.length; i += CONCURRENCY) {
        const chunk = docs.slice(i, i + CONCURRENCY);
        await Promise.all(
            chunk.map(async (doc) => {
                const r = doc.data();
                const storagePath: string = r.registrationForm.storagePath;
                const contentType: string = r.registrationForm?.contentType ?? '';
                const ext = contentType === 'application/pdf' ? '.pdf' : '.jpg';

                const mi = r.middleName?.trim()
                    ? ' ' + r.middleName.trim().charAt(0).toUpperCase() + '.'
                    : '';
                const baseName = `${r.lastName ?? ''}, ${r.firstName ?? ''}${mi}`;

                // Deduplicate: Santos, Juan D → Santos, Juan D (2) on collision.
                const count = (nameCount.get(baseName) ?? 0) + 1;
                nameCount.set(baseName, count);
                const fileName = count === 1 ? `${baseName}${ext}` : `${baseName} (${count})${ext}`;

                try {
                    const [buffer] = await bucket.file(storagePath).download();
                    zip.file(fileName, buffer);
                } catch {
                    // Skip files that fail to download rather than aborting the whole zip.
                }
            }),
        );
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(zipBuffer, {
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="reg-forms-${stamp}.zip"`,
            'Content-Length': String(zipBuffer.length),
        },
    });
}
