# TAPp (Talino at Puso App)

Constituent-services / barangay-management app for a congressional office.
Next.js 15 + React 19 + Firebase (Auth, Firestore) + Genkit AI.

## Quick Start

```bash
npm run dev        # localhost:9002
npm run build      # production build (TS + ESLint enforced)
npm run typecheck  # tsc --noEmit
```

## Code Navigation

- **Server actions**: `src/app/actions.ts` — all Firestore mutations, verified via `assertActor(idToken)`
- **Server auth**: `src/lib/server-auth.ts` — `assertActor()` verifies Firebase ID tokens using Admin SDK
- **Firebase Admin**: `src/lib/firebase-admin.ts` — Admin SDK init (auto-credentials on App Hosting)
- **Firebase Client**: `src/lib/firebase.ts` — client SDK init with IndexedDB persistence
- **Types**: `src/lib/types.ts` — `PageKey`, `UserProfile`, `RequestRecord`, `TaskRecord`, etc.
- **Access control**: `src/lib/access.ts` — `canViewPage()`, `canDo()`, `hasDistrictScope()`, role presets
- **Auth context**: `src/components/providers/auth-provider.tsx` — `useAuth()` hook, profile sync via onSnapshot
- **Audit logging**: `src/lib/audit.ts` — `logAudit()` writes to `auditLogs` collection

## Route Structure

All protected routes live under `src/app/(app)/`. Layout enforces auth + active user check.

| Route | PageKey | Purpose |
|---|---|---|
| `/` | `dashboard` | Dashboard |
| `/barangays`, `/barangays/[brgyId]` | `barangays_list` | Barangay list + detail |
| `/receiving` | `receiving` | Request/resolution intake workflow |
| `/medical/*` | `projects_medical` | Medical assistance records |
| `/educational/*` | `projects_educational` | Educational programs |
| `/infrastructure` | `projects_infrastructure` | Infrastructure projects |
| `/organization` | `organization_*` | Org members, departments, roles |
| `/tasker` | `tasker` | Kanban task board |
| `/analytics` | `analytics` | Analytics dashboard |
| `/profile` | `profile` | User profile |
| `/admin/users` | role-gated | User access management (admin/OIC only) |

## Patterns

- Every server action receives an `actorToken: string` (Firebase ID token) and calls `resolveActor()` to verify identity before any DB write.
- Client callers pass `await user!.getIdToken()` from the `useAuth()` hook.
- Firestore security rules (`firestore.rules`) are the data-level access boundary. Platform admin bypass via custom claim `platformAdmin`.
- Pages use `canViewPage(userProfile, pageKey)` for rendering guards.
- Data tables: TanStack React Table with per-page `columns.tsx` + `data-table.tsx`.
- Forms: react-hook-form + zod resolvers in dialog components under `_components/`.

## Firestore Collections

`users`, `barangays`, `lists` (denormalized lookups), `medicalRecords`, `requests`, `tasks`, `auditLogs`, `projectRecords`
