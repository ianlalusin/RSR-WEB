# User & Role Management — Blueprint
_Module: Auth/Access · Planner: master-planner · Date: 2026-04-20 · Parent blueprint: `../../.claude/plans/misty-toasting-pearl.md` · Dependent: `./scholarship-blueprint.md`_

## Context
Before building the Scholarship module (which introduces a new `applicant` role and 4 new PageKeys), fix the user/role foundation so every subsequent module inherits a solid base instead of layering onto soft spots. Recon showed the system is **cleaner than feared** — access logic is centralized, legacy fields are already dead in code, all consumers import from `src/lib/access.ts` — but there is one real security gap, one dead feature pretending to work, and a small pile of inconsistencies that will bite as new roles pile up. This blueprint is deliberately **surgical**, not a re-architecture: the parallel-sub-role pattern stays, self-provision onboarding stays, and we do not rewrite `access.ts` — we **fix**, **harden**, and **complete** it.

---

## 1. Goal
Close the server-side trust hole, make the role model extensible (rank-driven custom roles), retire dead code, and give the admin UI the small affordances it needs before Scholarship and Budget bolt on more roles.

## 2. Scope
**In scope**
- `assertActor` active-status enforcement.
- Role doc model: add `rank`, `preset`, `isBuiltIn`, `status` on `lists/roles/*` and drive authz from the doc, not from the hardcoded `ROLE_RANK` constant.
- Legacy field cleanup: remove `UserProfile.roles` and `UserProfile.permissions` from types.
- Admin UI: pending-user filter, role management UI (create/edit custom roles), "disable" clarity.
- `admin_users` PageKey actually used for route guarding.
- `hasDistrictScope` no longer hardcodes OIC — replaced by a `scopeBreadth` field on the role doc.
- One-time migration to eliminate runtime sanitization of malformed `access`.

**Out of scope (Deferred)**
- Invite flow / email invitations (self-provision stays).
- Unifying `socmedRole` into a single `domainRoles` field (keep parallel per your decision).
- Impersonation / "log in as user" admin feature.
- MFA, SSO beyond what Firebase Auth already supports.
- Separate `Applicant` auth surface (owned by Scholarship blueprint Phase 4).

## 3. Current State Summary *(from recon)*
**Strengths (keep)**
- Centralized `canViewPage` / `canDo` / `hasDistrictScope` in `src/lib/access.ts`.
- Every server mutation gated by `assertActor(idToken)` in `src/lib/server-auth.ts`.
- `UserProfile.access.pages` (PageKey × AccessLevel) + `access.districtIds` is a clean model.
- `platformAdmin` custom claim as an emergency bypass — untouched by this plan.
- Client-side runtime sanitization of malformed `access` (defensive, logs warnings).

**Gaps (fix)**
1. **`assertActor` does not check `isActive`** — disabled user with valid token can call server actions. *(Security.)*
2. **Custom roles in `lists/roles` are cosmetic** — `ROLE_RANK` is hardcoded to the 4 built-ins, `assignableRoles` only yields those, so custom roles can never be assigned nor can their holders manage anyone.
3. **`admin_users` PageKey defined but unused** — `/admin/users` gates inline with `isPlatformAdmin || isOIC`; `canViewPage('admin_users', …)` is never called.
4. **`/admin/page.tsx` exists but is not guarded** by `canViewPage` — manual verification needed; at minimum add a `canViewPage('admin_users')` guard.
5. **`hasDistrictScope` hardcodes `roleId === 'oic'`** as scope-wide — won't scale to Finance Officer or cross-district Scholarship Officer without editing code.
6. **`UserProfile.roles` / `UserProfile.permissions`** — zero reads/writes in src/, but still in type definition and eligible to be deleted.
7. **Malformed `access` data has been observed in prod** (sanitization warnings fire). A one-time migration would let us remove the runtime patch.
8. **Self-provision UX** — users sign in → get `isActive:false`, no roleId, `defaultAccess`; admin has to notice them. No "pending" filter exists.

## 4. Design Decisions *(Confirmed this session)*
- **Onboarding**: keep self-provision + approve. No invite flow.
- **Custom roles**: fix — make them real via a `rank` field on role docs.
- **Sub-roles**: keep parallel fields (`socmedRole`, and later additions) — no unification.
- **Applicant role** *(from Scholarship blueprint)*: still a top-level `UserRole` with a stripped `access.pages` (only `scholarship_portal`); bulk PII lives in a separate `applicants` collection.

## 5. Target Model

### 5.1 `Role` doc (`lists/roles/{roleId}`)
```ts
Role {
  id: string;                         // 'platformAdmin' | 'oic' | 'officeAdmin' | 'coordinator'
                                      // | 'applicant' | 'financeOfficer' | 'scholarshipOfficer'
                                      // | 'custom:<slug>'
  label: string;                      // display name
  rank: number;                       // authority level; higher beats lower; 0-100
  scopeBreadth: 'own_districts'       // can only see/act on own districtIds
              | 'all_districts'       // can see/act on all districts (OIC-like)
              | 'none';               // scope not applicable (e.g. applicant)
  preset?: Partial<Record<PageKey, AccessLevel>>;
                                      // default access.pages applied when role is assigned
  isBuiltIn: boolean;                 // true for the 4 originals + applicant + finance; prevents deletion
  status: 'active' | 'archived';
  createdAt, updatedAt;
}
```

**Built-in seed values:**
| id | rank | scopeBreadth | preset |
|----|------|--------------|--------|
| `platformAdmin` | 100 | all_districts | all `full` |
| `oic` | 80 | all_districts | current `oicAccess` preset |
| `officeAdmin` | 60 | own_districts | current `officeAdminAccess` preset |
| `coordinator` | 40 | own_districts | current `coordinatorAccess` preset |
| `applicant` | 10 | none | `{ scholarship_portal: 'full' }` only |
| `financeOfficer` *(Proposed — Phase 2/future)* | 70 | all_districts | TBD when Budget plans |

Custom roles land between these as the admin chooses, but can never exceed the creator's rank.

### 5.2 `UserProfile` (cleaned)
```ts
UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  isActive: boolean;
  departmentId?: string;
  roleId?: string;                    // references Role.id; may be unset for pending users
  access: {
    pages: Partial<Record<PageKey, PageAccess>>;
    districtIds: string[];
  };
  socmedRole?: SocmedRole;            // parallel sub-role, kept
  // FUTURE (when modules land; DO NOT add pre-emptively):
  // scholarshipOfficerRole?: ...
  // financeOfficerRole?: ...
  createdAt, updatedAt;
  // REMOVED: roles, permissions (legacy, never read)
}
```

### 5.3 Access helpers (`src/lib/access.ts`) — behavior changes
- `ROLE_RANK` constant **deleted**. A new `getRoleRank(roleId: string, roles: Role[]): number` reads from passed-in role docs. In practice, the `useAuth()` hook loads all active roles once and caches them, so every access call has them.
- `assignableRoles(actor, roles)` — returns active, non-archived roles with `rank < actor.rank`.
- `canManageUser(actor, target, roles)` — compares looked-up ranks.
- `canViewPage`, `canDo` — **unchanged** (they already work off `access.pages`, not `roleId`).
- `hasDistrictScope(u, districtId, roles)` — remove OIC hardcode; read `scopeBreadth` from the user's role doc. `all_districts` → true, `own_districts` → `districtIds.includes(districtId)`, `none` → false. Claim still wins.
- New: `resolveRole(user, roles): Role | null` — one helper to look up a user's role doc. Used everywhere rank or scope is needed.

### 5.4 Server auth (`src/lib/server-auth.ts`)
`assertActor(idToken)` → now:
1. Verify token (as today).
2. Load `users/{uid}` via Admin SDK.
3. Throw if user doc missing OR `isActive !== true` (**unless** the token carries `platformAdmin` claim — the emergency bypass still wins, but logs a warning: "platformAdmin acting on inactive Firestore profile").
4. Return `VerifiedActor { uid, email, isPlatformAdmin, profile, role? }` — now includes the Firestore profile and (optionally) the resolved role doc, so server actions don't each do a second read.

Existing 35+ server actions already call a local `resolveActor(token)` wrapper — that wrapper absorbs the new contract; most call sites need no change.

## 6. Security Hardening
- **Active check on every mutation** via `assertActor` change above. This is the #1 priority item.
- **Firestore rules audit** (route to `firestore-rules-check`):
  - `users/{uid}` create rule: only the authenticated user can self-provision their own doc, with fixed defaults (`isActive: false`, `access: defaultAccess`, no `roleId`). Prevents a user from self-elevating at creation.
  - `users/{uid}` update rule: only users with `admin_users` PageKey `readwrite+` can touch `isActive`, `roleId`, `access.*`, `departmentId`. Self-updates limited to `displayName`, `photoURL`.
  - `lists/roles/{roleId}` write rule: only platformAdmin.
- **Audit log every role/access/active change** — verify today's `logAudit` covers every `updateUserAccess` path; extend if not. Target: `auditLogs` entry for every change to `isActive`, `roleId`, `access.pages[*]`, `access.districtIds`.
- **Rate limit** on `updateUserAccess` server action (e.g. max N changes per actor per minute) — prevents scripted mass-re-permission. *(Proposed.)*

## 7. Admin UX Polish *(small, not a redesign)*
- **Pending tab** on `/admin/users`: filter = users with no `roleId` OR `isActive: false`. Highlights them at the top.
- **Role management UI** at `/organization/roles` (may partially exist — refactor, don't duplicate): list roles, create/edit, set `rank`, `scopeBreadth`, `preset`; built-in roles show preset read-only and `rank` locked.
- **"Disable user" vs "Delete user"**: relabel current disable toggle for clarity; no delete capability is introduced (matches no-invite decision — inactive records stay for audit).
- **Route guard `admin_users`**: wire `canViewPage('admin_users', user, {claim})` into `/admin/*` page gating so the PageKey stops being dead.
- **`/admin/page.tsx`**: verify it exists, then either remove it or guard it. *(Unresolved — see §11.)*

## 8. Migration & Cleanup
**Pass A — role docs seed** *(one-time script, `scripts/seed-roles.js`)*
- Upsert 5 built-in role docs (`platformAdmin`, `oic`, `officeAdmin`, `coordinator`, `applicant`) with `isBuiltIn: true`, `rank`, `scopeBreadth`, and `preset` copied from current `ROLE_PRESETS`.
- Mark any existing `lists/roles` docs that don't match as `isBuiltIn: false` and assign a low rank (e.g. 20) pending admin review.

**Pass B — user profile sanity** *(one-time script, `scripts/backfill-user-access.js`)*
- Read every `users/*` doc. If `access` is missing, not an object, or `access.pages` is an array → overwrite with `defaultAccess`. Log each fix.
- Remove `roles` and `permissions` fields from every user doc (Firestore `FieldValue.delete()`).
- Run this **before** removing the runtime sanitizer in `auth-provider.tsx`.

**Pass C — code cleanup**
- Delete `ROLE_RANK` constant and `ROLE_PRESETS` map from `access.ts`; replace with role-doc lookups.
- Delete `roles?` and `permissions?` properties from `UserProfile` in `types.ts`.
- Delete runtime `access` sanitization branch in `auth-provider.tsx` (keep `districtIds` coercion — harmless).
- Replace `isOIC(u)` call sites that only check "can see all districts" with `hasDistrictScope(u, districtId, roles)` or the new `scopeBreadth` check. Keep `isOIC` only for UI copy.

## 9. Phases

**Phase 1 — Security fix (ship first, small)**
- `assertActor` checks `isActive` + returns profile.
- Pass B migration (sanity + drop legacy fields).
- Remove runtime sanitizer.
- Route: `fullstack-engineer`, `firestore-rules-check`, `qa-tester` (verify all mutations still work).

**Phase 2 — Role doc model**
- Add `rank`, `scopeBreadth`, `preset`, `isBuiltIn`, `status` to `Role` type.
- Pass A migration (seed built-ins, including `applicant`).
- Refactor `access.ts` to read from role docs; delete `ROLE_RANK`/`ROLE_PRESETS`.
- Update `assignableRoles`, `canManageUser`, `hasDistrictScope`.
- Route: `fullstack-engineer`, `qa-tester` (permission matrix regression).

**Phase 3 — Admin UX polish**
- Pending filter, role management UI, relabel disable, wire `admin_users` guard.
- Route: `ui-ux-design` (light — it's mostly an existing screen), `fullstack-engineer`, `qa-tester`.

**Phase 4 — Firestore rules + audit completeness**
- Tighten `users/*` create/update rules per §6.
- Add rate-limit to `updateUserAccess` *(optional; can defer)*.
- Verify/extend `auditLogs` coverage for role/access/active changes.
- Route: `firestore-rules-check`, `fullstack-engineer`.

**Phase 5 — Unblock Scholarship Phase 1**
- Ensure the `applicant` role doc is seeded.
- Add scholarship PageKeys (`scholarship_providers`, `scholarship_applications`, `scholarship_scholars`, `scholarship_portal`) to `PageKey` union and to built-in role presets.
- Hand off to Scholarship build.
- Route: `fullstack-engineer` → then Scholarship blueprint Phase 2.

## 10. Skill Routing
| Area | Skill | Why |
|------|-------|-----|
| `assertActor` + active-check | `fullstack-engineer` | Touches every mutation path; small, surgical |
| Role doc refactor | `fullstack-engineer` | Swaps constants for Firestore reads |
| Migration scripts | `fullstack-engineer` | Admin-SDK one-shot scripts in `scripts/` |
| Firestore rules for `users/*` and `lists/roles/*` | `firestore-rules-check` | Prevents self-elevation, locks role-doc edits |
| Admin UI updates (pending filter, role management) | `fullstack-engineer` lead, `ui-ux-design` review | Mostly existing screen extensions |
| Permission-matrix regression testing | `qa-tester` | Role changes are the highest blast-radius refactor here |
| Audit log coverage check | `fullstack-engineer` | Verify every role/access write logs |
| Business copy for role descriptions + UI labels | `docs-ready` | Optional, small |

## 11. Assumptions & Open Questions
**Confirmed (this session)**
- Self-provision onboarding stays.
- Custom roles get rank-driven real authz.
- Parallel sub-role fields stay (`socmedRole`, future additions).
- `assertActor` active-check is required.

**Inferred**
- `platformAdmin` claim remains the ultimate emergency bypass, even over inactive status. Document this explicitly in CLAUDE.md.
- Built-in role ranks (100/80/60/40/10) are reasonable spacings; custom roles slot into the gaps.
- OICs should be able to manage custom roles below them but **not** edit built-in role presets — only platformAdmin edits built-ins.

**Proposed**
- `scopeBreadth` field on `Role` replacing the OIC hardcode.
- Specific rank numbers and spacings above.
- Role-management UI lives at `/organization/roles`.
- One-time migration scripts in `scripts/`.

**Unresolved**
- Does `/admin/page.tsx` currently have content, and if so, what is it? (Verify and either guard or remove.)
- Should OIC or only platformAdmin be allowed to create custom roles? *(Suggest: platformAdmin + OIC for custom, platformAdmin only for built-in edits.)*
- Rate-limiting on `updateUserAccess` — defer or include in Phase 4?
- When a user's role doc is archived, what happens to users holding that role? *(Suggest: they retain access until an admin reassigns them; UI flags "role archived".)*

**Deferred**
- Invite flow.
- Socmed (and future) sub-role unification.
- Impersonation.
- SSO/MFA enhancements.

## 12. Single Recommended Next Step
Route **Phase 1** (active-check on `assertActor` + legacy field cleanup + one-time user access migration) to `fullstack-engineer`. That single change closes the only real security hole and clears the deck for the role-doc refactor. Everything else in this blueprint builds on top.
