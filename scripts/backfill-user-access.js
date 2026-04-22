/**
 * One-time migration: backfill-user-access.js
 *
 * What it does:
 *   1. Reads every document in the `users` collection.
 *   2. If `access` is missing or structurally malformed (the bug seen in prod),
 *      resets it to `defaultAccess` (dashboard + profile readonly).
 *   3. Removes the legacy `roles` and `permissions` fields from every user doc
 *      via FieldValue.delete() — these were deprecated and have had zero reads
 *      in application code for some time.
 *
 * Run BEFORE removing the runtime sanitizer in auth-provider.tsx.
 * Safe to run multiple times (idempotent writes — unchanged docs are not re-written).
 *
 * Requirements:
 *   Place your Firebase service account JSON at: scripts/serviceAccountKey.json
 *   Run: node scripts/backfill-user-access.js
 */

const admin = require('firebase-admin');
const path = require('path');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });

const db = admin.firestore();

const defaultAccess = {
  pages: {
    dashboard: { level: 'readonly' },
    profile: { level: 'readonly' },
  },
  districtIds: [],
};

function isMalformedAccess(access) {
  if (!access || typeof access !== 'object' || Array.isArray(access)) return true;
  if (!access.pages || typeof access.pages !== 'object' || Array.isArray(access.pages)) return true;
  return false;
}

async function main() {
  const snapshot = await db.collection('users').get();
  console.log(`Found ${snapshot.size} user documents.`);

  let fixed = 0;
  let skipped = 0;
  const batch = db.batch();

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const ref = docSnap.ref;
    const update = {};
    let needsWrite = false;

    // Fix malformed access
    if (isMalformedAccess(data.access)) {
      console.log(`  [FIX access] uid=${data.uid ?? docSnap.id}`);
      update.access = defaultAccess;
      needsWrite = true;
    } else if (!Array.isArray(data.access?.districtIds)) {
      // access shape is fine but districtIds is not an array
      console.log(`  [FIX districtIds] uid=${data.uid ?? docSnap.id}`);
      update['access.districtIds'] = [];
      needsWrite = true;
    }

    // Remove legacy fields
    if ('roles' in data) {
      update.roles = admin.firestore.FieldValue.delete();
      needsWrite = true;
    }
    if ('permissions' in data) {
      update.permissions = admin.firestore.FieldValue.delete();
      needsWrite = true;
    }

    if (needsWrite) {
      batch.update(ref, update);
      fixed++;
    } else {
      skipped++;
    }
  }

  if (fixed > 0) {
    await batch.commit();
    console.log(`\nDone. Updated ${fixed} documents, ${skipped} were already clean.`);
  } else {
    console.log(`\nAll ${skipped} documents were already clean. No writes needed.`);
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
