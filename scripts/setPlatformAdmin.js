/**
 * One-time bootstrap script to set { platformAdmin: true } custom claim.
 *
 * Requirements:
 * - Place your Firebase service account JSON at: scripts/serviceAccountKey.json
 * - Run: node scripts/setPlatformAdmin.js <uid>
 */
const admin = require("firebase-admin");
const path = require("path");

const keyPath = path.join(__dirname, "serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(require(keyPath)),
});

async function main() {
  const uid = process.argv[2];
  if (!uid) {
    console.error("Usage: node scripts/setPlatformAdmin.js <uid>");
    process.exit(1);
  }

  // Preserve existing claims (if any), then add platformAdmin: true
  const user = await admin.auth().getUser(uid);
  const existing = user.customClaims || {};
  const nextClaims = { ...existing, platformAdmin: true };

  await admin.auth().setCustomUserClaims(uid, nextClaims);

  console.log("✅ platformAdmin claim set for:", uid);
  console.log("Claims now:", nextClaims);
}

main().catch((err) => {
  console.error("❌ Failed:", err);
  process.exit(1);
});
