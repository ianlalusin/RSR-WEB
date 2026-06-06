/**
 * One-time migration: migrate-barangays-to-cycles.js
 *
 * Purpose:
 *   Convert flat per-barangay electoral fields into a cycle-versioned subcollection
 *   so we can record new captains / officials / results when the 2028 election
 *   rolls around without overwriting the 2025 baseline.
 *
 * For each `barangays/{id}` doc the script:
 *   1. Skips it if `currentCycle` is already set (idempotent).
 *   2. Writes `barangays/{id}/cycles/{TARGET_YEAR}` carrying the existing
 *      votingPopulation / rsrVotes / favoredVotePct / isWin, plus the contents of
 *      `barangays/{id}/captainProfile/main` if that doc exists.
 *   3. Sets `currentCycle` and `currentStats` on the parent doc.
 *   4. Leaves `barangays/{id}/captainProfile/main` and the legacy flat fields
 *      in place as a frozen backup. A follow-up cleanup script can remove them
 *      once the migration is verified.
 *
 * It also patches `lists/barangays` so each entry gets `currentCycle` (other
 * BarangayListItem fields are unchanged).
 *
 * Requirements:
 *   Place a Firebase service account JSON at: scripts/serviceAccountKey.json
 *   Run: node scripts/migrate-barangays-to-cycles.js
 *
 * Override the target year (defaults to "2025") via env:
 *   TARGET_YEAR=2025 node scripts/migrate-barangays-to-cycles.js
 */

const admin = require('firebase-admin');
const path = require('path');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });

const db = admin.firestore();
const TARGET_YEAR = process.env.TARGET_YEAR || '2025';

async function main() {
  const snapshot = await db.collection('barangays').get();
  console.log(`Found ${snapshot.size} barangay documents. Target cycle: ${TARGET_YEAR}`);

  let migrated = 0;
  let skipped = 0;
  let listPatches = 0;
  const listUpdates = {};

  for (const brgyDoc of snapshot.docs) {
    const data = brgyDoc.data();
    const brgyId = brgyDoc.id;

    if (data.currentCycle) {
      skipped++;
      continue;
    }

    const stats = {
      votingPopulation: Number(data.votingPopulation ?? 0),
      rsrVotes: Number(data.rsrVotes ?? 0),
      favoredVotePct: Number(data.favoredVotePct ?? 0),
      isWin: Boolean(data.isWin ?? false),
    };

    // Pull legacy captain profile if it exists
    const profileSnap = await db
      .collection('barangays').doc(brgyId)
      .collection('captainProfile').doc('main')
      .get();
    const profile = profileSnap.exists ? profileSnap.data() : null;

    const cycleData = {
      year: TARGET_YEAR,
      ...stats,
      captain: profile?.captain ?? { name: '' },
      secretary: profile?.secretary ?? {},
      councilors: profile?.councilors ?? [],
      createdAt: profile?.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
      createdByUid: profile?.createdByUid ?? 'migration',
      createdByEmail: profile?.createdByEmail ?? null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByUid: 'migration',
      updatedByEmail: null,
    };

    const batch = db.batch();
    const cycleRef = db.collection('barangays').doc(brgyId).collection('cycles').doc(TARGET_YEAR);
    batch.set(cycleRef, cycleData);

    batch.update(brgyDoc.ref, {
      currentCycle: TARGET_YEAR,
      currentStats: stats,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await batch.commit();

    listUpdates[`barangays.${brgyId}.currentCycle`] = TARGET_YEAR;
    listPatches++;
    migrated++;
    console.log(`  [migrated] ${brgyId} (${data.name ?? '?'})`);
  }

  if (listPatches > 0) {
    await db.collection('lists').doc('barangays').update(listUpdates);
    console.log(`\nPatched lists/barangays with currentCycle for ${listPatches} entries.`);
  }

  console.log(`\nDone. Migrated ${migrated}, skipped ${skipped} (already had currentCycle).`);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
