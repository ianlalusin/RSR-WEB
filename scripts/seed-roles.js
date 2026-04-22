/**
 * One-time migration: seed-roles.js
 *
 * Upserts the built-in role definitions into the `lists/roles` Firestore document.
 * Each built-in role gets: rank, scopeBreadth, preset, isBuiltIn, status.
 *
 * Existing custom role entries in the map are left untouched (they get rank=20,
 * scopeBreadth=own_districts, isBuiltIn=false if they don't already have those fields).
 *
 * Safe to re-run — built-in entries are always overwritten with canonical values.
 *
 * Requirements:
 *   Place your Firebase service account JSON at: scripts/serviceAccountKey.json
 *   Run: node scripts/seed-roles.js
 */

const admin = require('firebase-admin');
const path = require('path');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });

const db = admin.firestore();

const ALL_PAGE_KEYS = [
  'dashboard', 'barangays_list', 'barangay_detail',
  'organization_orgMembers', 'organization_departments', 'organization_roles',
  'receiving', 'projects_medical', 'projects_hospitals',
  'projects_educational', 'projects_infrastructure',
  'tasker', 'analytics', 'profile', 'admin_users', 'socmed',
  'scholarship_providers', 'scholarship_applications', 'scholarship_scholars', 'scholarship_portal',
];

function buildPreset(levels) {
  return ALL_PAGE_KEYS.reduce((acc, key) => {
    acc[key] = levels[key] ?? 'restricted';
    return acc;
  }, {});
}

const BUILT_IN_ROLES = {
  platformAdmin: {
    name: 'Platform Admin',
    rank: 100,
    scopeBreadth: 'all_districts',
    preset: buildPreset(ALL_PAGE_KEYS.reduce((a, k) => { a[k] = 'full'; return a; }, {})),
    isBuiltIn: true,
    status: 'active',
  },
  oic: {
    name: 'OIC (Superuser)',
    rank: 80,
    scopeBreadth: 'all_districts',
    preset: buildPreset({
      dashboard: 'full', barangays_list: 'full', barangay_detail: 'full',
      organization_orgMembers: 'full', organization_departments: 'full', organization_roles: 'full',
      receiving: 'full', projects_medical: 'full', projects_hospitals: 'full',
      projects_educational: 'full', projects_infrastructure: 'full',
      tasker: 'full', analytics: 'full', profile: 'full',
      admin_users: 'readwrite', socmed: 'full',
      scholarship_providers: 'full', scholarship_applications: 'full',
      scholarship_scholars: 'full', scholarship_portal: 'restricted',
    }),
    isBuiltIn: true,
    status: 'active',
  },
  officeAdmin: {
    name: 'Office Admin',
    rank: 60,
    scopeBreadth: 'own_districts',
    preset: buildPreset({
      dashboard: 'readwrite', barangays_list: 'readwrite', barangay_detail: 'readwrite',
      organization_orgMembers: 'full', organization_departments: 'full', organization_roles: 'full',
      receiving: 'readwrite', projects_medical: 'readwrite', projects_hospitals: 'readwrite',
      projects_educational: 'readwrite', projects_infrastructure: 'readwrite',
      tasker: 'readwrite', analytics: 'readonly', profile: 'readwrite',
      admin_users: 'restricted', socmed: 'readwrite',
      scholarship_providers: 'readwrite', scholarship_applications: 'readwrite',
      scholarship_scholars: 'readwrite', scholarship_portal: 'restricted',
    }),
    isBuiltIn: true,
    status: 'active',
  },
  coordinator: {
    name: 'Coordinator',
    rank: 40,
    scopeBreadth: 'own_districts',
    preset: buildPreset({
      dashboard: 'readonly', barangays_list: 'readwrite', barangay_detail: 'readwrite',
      organization_orgMembers: 'readonly',
      receiving: 'readwrite', projects_medical: 'readwrite', projects_hospitals: 'readonly',
      projects_educational: 'readonly', projects_infrastructure: 'readonly',
      tasker: 'readonly', profile: 'readwrite', socmed: 'readwrite',
      scholarship_providers: 'restricted', scholarship_applications: 'readonly',
      scholarship_scholars: 'readonly', scholarship_portal: 'restricted',
    }),
    isBuiltIn: true,
    status: 'active',
  },
  applicant: {
    name: 'Applicant',
    rank: 10,
    scopeBreadth: 'none',
    preset: buildPreset({ profile: 'readwrite', scholarship_portal: 'full' }),
    isBuiltIn: true,
    status: 'active',
  },
};

async function main() {
  const ref = db.doc('lists/roles');
  const snap = await ref.get();
  const existing = snap.exists ? (snap.data().roles || {}) : {};

  const now = admin.firestore.FieldValue.serverTimestamp();

  // Merge: built-ins are overwritten; existing custom roles get default new fields if missing
  const merged = { ...existing };

  for (const [id, data] of Object.entries(existing)) {
    if (!BUILT_IN_ROLES[id] && !('rank' in data)) {
      merged[id] = {
        ...data,
        rank: 20,
        scopeBreadth: 'own_districts',
        isBuiltIn: false,
        status: 'active',
        updatedAt: now,
      };
      console.log(`  [UPGRADE custom role] ${id}`);
    }
  }

  for (const [id, data] of Object.entries(BUILT_IN_ROLES)) {
    merged[id] = {
      ...data,
      createdAt: existing[id]?.createdAt ?? now,
      updatedAt: now,
    };
    console.log(`  [SEED built-in] ${id} (rank=${data.rank})`);
  }

  await ref.set({ roles: merged }, { merge: true });
  console.log(`\nDone. Seeded ${Object.keys(BUILT_IN_ROLES).length} built-in roles.`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
