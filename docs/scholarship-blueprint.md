# Scholarship Module — Blueprint
_Module: Scholarship · Planner: master-planner · Date: 2026-04-20 · Parent blueprint: `../../.claude/plans/misty-toasting-pearl.md`_

## Context
The existing `/educational/scholarship` and `/educational/ched` pages are "Coming Soon" stubs. This blueprint **remodels Scholarship from a single program into a generic scholarship-management subsystem** that handles many providers (CHED, partner schools, govt agencies, private donors, and the office's own Cong Scholarship) under one unified model, with configurable assistance types, beneficiary quotas, requirement checklists, applicant intake (both staff-entered and eventually a public portal), and a filtered "qualified scholars" roster. It replaces the old single-program assumption — the new primitive is **Provider → Program → Application → Scholar**.

**Scope decisions (Confirmed from user this session):**
- **Applicants**: hybrid — staff-entered AND public self-service portal (staged: staff-entry first, portal later).
- **Providers**: unified — one model covers external sponsors (CHED, schools, govt, donors) and office-funded programs, distinguished by a `fundingSource` flag.
- **Shape**: full blueprint now, build in phases.

---

## 1. Business Goal
Give the office a single place to **publish scholarship opportunities from any provider**, collect and vet applications with clear requirement checklists, approve qualified scholars, and (for office-funded programs) tie disbursement to the Budget module — replacing fragmented program tracking and making it easy for constituents to find opportunities they actually qualify for.

## 2. Module Scope
- **In scope**: Providers, Programs (a.k.a. scholarship offerings), Requirements, Applications, Scholars, staff intake UI, public applicant portal (later phase), document uploads, basic matching/filtering, audit trail, role-based review workflow.
- **Out of scope (Deferred)**: Academic performance tracking over time (GPA history, grade uploads each term), alumni tracking, payment integration with banks, SMS reminders, automated eligibility scoring.
- **Integration points**: Barangay (applicant district scoping), Budget module *(Phase 5 — only for `fundingSource = office`)*, Reporting module, AuditLog, Receiving (an approved request may spawn a scholarship application).

## 3. Target Users
| User | Primary task | Surface |
|------|-------------|---------|
| Applicant *(new role)* | Browse programs, see requirements, submit application, check status | Mobile-first public portal *(Phase 4)* + staff-entered intake form |
| Coordinator | Endorse applicants from own barangay, attach local attestations | Existing app, new `/scholarship` subsection |
| Scholarship Officer *(new role or page-level grant)* | Configure providers + programs + requirements, screen applications, move statuses | Desktop |
| OIC | Approve awards, especially office-funded or over-threshold | Desktop |
| Finance Officer *(Proposed, shared with Budget module)* | Disburse office-funded awards | Desktop |
| PlatformAdmin | Everything, including archiving providers | Desktop |

## 4. Roles & Permissions (New `PageKey`s)
New `PageKey`s to add:
- `scholarship_providers` — CRUD on Providers and Programs (Scholarship Officer, OIC, platformAdmin).
- `scholarship_applications` — view/review/move-status on Applications (Scholarship Officer, OIC, Coordinator — scoped to own barangay).
- `scholarship_scholars` — read-only roster of qualified/active Scholars (officeAdmin-level + above).
- `scholarship_portal` — applicant-facing; the only PageKey an `applicant` role can see.

`applicant` is a new top-level role (sibling to `coordinator`). Its `UserProfile` is stripped down — no district assignment, only a link to their own Applicant record. All other existing roles ignore the `applicant` role.

## 5. Core Entities

### 5.1 Provider
```ts
Provider {
  id: string;
  name: string;                       // "CHED", "University of XYZ", "Cong Office"
  fundingSource: "external" | "office"; // drives whether Budget is hit
  type: "govt_agency" | "school" | "private_donor" | "office_program" | "ngo";
  contactPerson?: string;
  contactEmail?: string;
  notes?: string;
  status: "active" | "archived";
  createdAt, updatedAt, createdByUid;
}
```
District scope: providers are **global** (not district-scoped). Any district's applicants can apply. Office-funded providers may have per-district allocations via Budget.

### 5.2 Program (a.k.a. ScholarshipOffering)
```ts
Program {
  id: string;
  providerId: string;                 // -> Provider
  title: string;                      // "CHED Tulong Dunong 2026"
  description: string;
  assistanceTypes: AssistanceType[];  // ["monetary", "laptop"] — multi-select
  totalSlots: number;                 // quota
  slotsFilled: number;                // derived, updated transactionally on award
  valuePerSlot?: { amount: number; currency: "PHP" } | null; // optional, monetary programs
  applicationPeriod: { opensAt: Timestamp; closesAt: Timestamp };
  academicYear?: string;              // "2026-2027"
  eligibilityBlurb: string;           // short human-readable summary
  requirements: RequirementSpec[];    // the checklist (see 5.3)
  status: "draft" | "open" | "closed" | "archived";
  fundingSource: "external" | "office"; // denormalized from Provider for query speed
  createdAt, updatedAt, createdByUid;
}

type AssistanceType =
  | "monetary"
  | "tuition_discount"
  | "voucher"
  | "laptop"
  | "allowance"
  | "book_supplies"
  | "internship"
  | "other";
```

### 5.3 RequirementSpec (embedded in Program)
```ts
RequirementSpec {
  key: string;                        // stable id within the program
  label: string;                      // "Certificate of Indigency"
  description?: string;
  kind: "doc_upload" | "attestation" | "threshold" | "text_response";
  required: boolean;
  validationHint?: string;            // "Max 5MB PDF", "Must be from current barangay captain"
  threshold?: { field: "age" | "family_income" | "gpa"; op: "<=" | ">=" | "=="; value: number };
}
```
Requirements are defined per Program, not globally — different providers want different docs. A few **canonical keys** are suggested (`indigency_cert`, `barangay_endorsement`, `school_cor`, `grades`, `parent_itr`) so reporting can aggregate "how many need indigency certs" across programs, but the list is free.

### 5.4 Applicant *(separate from `UserProfile`)*
```ts
Applicant {
  id: string;                         // == authUid if portal-signed-up; else generated
  source: "staff_entered" | "self_registered";
  fullName, dateOfBirth, sex, contactPhone, contactEmail;
  barangayId: string;                 // REQUIRED — must reference existing barangay doc
  householdInfo?: { ... };            // parent names, income bracket, etc.
  educationStatus?: { level, school, year };
  linkedAuthUid?: string;             // if they later sign up to the portal
  status: "active" | "blocked";
  createdAt, updatedAt, createdByUid;
}
```
**Why separate from UserProfile**: applicants vastly outnumber staff. Mixing them into `UserProfile` pollutes role resolution and risks granting an applicant a staff PageKey by accident. A staff-entered applicant has no `authUid` until (optionally) they claim the record via portal signup.

**Barangay linkage is mandatory (Confirmed)**: every applicant must reference an existing `barangays/{brgyId}` document. District scoping derives from this. Staff-entry form and portal signup both enforce a barangay selector — if the barangay doesn't exist in the system, it must be added first by staff, not inline by an applicant.

### 5.5 Application
```ts
Application {
  id: string;
  applicantId: string;                // -> Applicant
  programId: string;                  // -> Program
  providerIdDenorm: string;           // for fast filtering
  barangayIdDenorm: string;           // district scoping without join
  submittedRequirements: Record<requirementKey, SubmittedAnswer>;
  checklistCompletion: number;        // 0..1, derived
  endorsedByCoordinatorUid?: string;
  endorsementNotes?: string;
  reviewerUid?: string;
  reviewNotes?: string;
  decision?: "approved" | "rejected" | "waitlisted";
  status: ApplicationStatus;
  timeline: StatusChange[];           // append-only
  createdAt, updatedAt, createdByUid;
}

type ApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "endorsed"       // by coordinator
  | "approved"       // by officer/OIC
  | "awarded"        // slot committed
  | "released"       // funds/benefit delivered
  | "completed"
  | "rejected"
  | "cancelled";

type SubmittedAnswer =
  | { kind: "doc_upload"; fileUrl: string; fileName: string; uploadedAt: Timestamp }
  | { kind: "text_response"; text: string }
  | { kind: "attestation"; attestedAt: Timestamp; attestedBy: string }
  | { kind: "threshold"; value: number };
```

### 5.6 Scholar (view / lightweight record)
A Scholar is **not** a new write-heavy entity — it's a query over `Application` where `status IN ("awarded","released","completed")`, enriched with applicant+program data. We **do** maintain a small `Scholar` document per awarded application so we can attach ongoing notes without mutating the historical Application:
```ts
Scholar {
  id: string;                         // == Application.id
  applicantId, programId, providerId;
  academicYear;
  currentStatus: "active" | "graduated" | "dropped" | "suspended";
  notes?: string;
  nextReviewAt?: Timestamp;
  createdAt, updatedAt;
}
```

## 6. Workflows

### 6.1 Provider & Program setup
Scholarship Officer creates a Provider → creates one or more Programs under it → defines requirements checklist → sets slot count + period → moves status `draft → open`. Audit entry per change.

### 6.2 Staff-entered application *(Phase 2)*
1. Coordinator or Officer opens `/scholarship/applications/new`.
2. Picks an open Program → sees its requirements.
3. Selects an existing Applicant (search) or creates a new one inline.
4. Fills/uploads each requirement; `checklistCompletion` auto-updates.
5. `draft → submitted`. Audit written.

### 6.3 Public self-service application *(Phase 4)*
1. Applicant signs up via portal (email/phone/Google). `Applicant` record created with `source: self_registered`, `linkedAuthUid` set.
2. Applicant browses `/scholarship/portal/programs`, filtered by eligibility (age, location, year level — derived from their profile).
3. Opens a program, sees requirements, uploads/fills, submits.
4. Same `Application` record shape as staff-entered.

### 6.4 Review & approval
`submitted` → Coordinator of applicant's barangay is notified → optionally endorses (`endorsed`) → Scholarship Officer reviews (`under_review` → `approved | rejected | waitlisted`) → on approval, slot is committed transactionally (Program.slotsFilled++, Application `awarded`) → for office-funded programs, Budget `Commitment` is written → Finance releases funds → `released` → upon verification, `completed`.

**Approval authority (Confirmed)**: for office-funded awards, **OIC signs alone** — no separate Finance Officer signatory gate. Finance's role is limited to executing the disbursement after OIC approval, not approving it. This keeps the chain: Officer review → OIC approve → Finance release.

### 6.5 Exceptions
- **Over-quota**: cannot move to `awarded` if `slotsFilled >= totalSlots`. Must reject or waitlist.
- **Withdrawal**: any state before `released` can go to `cancelled` (with reason).
- **Reversal after release**: only platformAdmin, always paired with a reversal note + audit entry; if office-funded, writes a compensating Budget entry.
- **Duplicate applications**: one applicant × one program = one active application; subsequent attempts warn and link to the existing one.
- **Concurrent awards across programs (Confirmed)**: an applicant may hold multiple active awards from different providers/programs simultaneously. No global "one award at a time" lock. Individual programs may still cap via their own eligibility rules, but the system does not enforce cross-program exclusivity. *(Revisit if fairness policy tightens later.)*

## 7. Data Architecture
- **Firestore collections** *(all new)*: `scholarshipProviders`, `scholarshipPrograms`, `applicants`, `applications`, `scholars`.
- **Transactions** required for:
  - Approving an application (decrement slot, write Commitment if office-funded).
  - Reversing a released application.
  - Closing a Program (verify slot counts reconcile).
- **Denormalized fields**: `providerIdDenorm`, `barangayIdDenorm`, `fundingSource` on Application — saves joins for filters.
- **District scope**: applied at the Application level via `barangayIdDenorm` → lookup district. Providers/Programs are global.
- **Indexes**: `applications` by (`programId`, `status`), (`applicantId`, `status`), (`barangayIdDenorm`, `status`); `scholars` by (`currentStatus`, `academicYear`).
- **Storage**: Firebase Storage bucket for requirement doc uploads; path `scholarship/{programId}/{applicationId}/{requirementKey}/{fileName}`.

## 8. Firestore Rules Direction
- `scholarshipProviders`, `scholarshipPrograms`: read = any authenticated user (so coordinators/applicants can browse); write = `scholarship_providers` PageKey level `readwrite+` OR `platformAdmin`.
- `applicants`: read = self (if `linkedAuthUid` matches) OR staff with `scholarship_applications` read; write = self (own record) OR staff.
- `applications`: read = applicant-owner OR staff scoped to barangay district; write rules mirror status transitions — can't skip states.
- `scholars`: read = staff with `scholarship_scholars`; write = officer/OIC only.
- Route to `firestore-rules-check` before ship.

## 9. UI/UX Direction

### 9.1 Staff surface (existing app)
Top-level nav: `/scholarship` → tabs: **Providers · Programs · Applications · Scholars**.
- Providers: table with fundingSource badge, active count of programs, archive action.
- Programs: card grid with slot progress bar, requirement count, status chip.
- Applications: TanStack table with filters (program, status, barangay, checklist%), row drawer for review.
- Scholars: filterable roster, exportable.

### 9.2 Public portal *(Phase 4 — separate route group)*
Add `src/app/(portal)/scholarship/*` — a parallel protected layout gated by `applicant` role only. Mobile-first. Key screens: Browse Programs (with filters), Program Detail (shows full requirement list BEFORE login), My Applications, Profile.

**Portal auth (Confirmed)**: email/password **and** Google OAuth (Gmail). No phone/SMS signup. Both providers resolve to the same `Applicant` record via `linkedAuthUid`. Signup flow requires a mandatory barangay selector (searchable list of existing barangays).

Route to `ui-ux-design` for: applicant portal screens, program detail card (public-facing), and the officer review drawer.

## 10. Dependencies & Risks
- **Depends on a light user/role pass first** — specifically: introducing the `applicant` role and the 4 new PageKeys. This is a Phase 1 prerequisite, not a separate initiative.
- **Budget module is NOT a blocker** — office-funded programs can initially record awards without full ledger wiring; Phase 5 retrofits them.
- **Storage cost + file validation** — doc uploads can balloon. Enforce size/type limits in rules AND client.
- **Duplicate applicant records** — staff-entered and later self-registered could create two records for the same person. Provide a "claim" flow (OTP to phone/email) that merges.
- **Fairness / audit** — every status change on an application must be in the `timeline[]` with actor + timestamp + note. This is the anti-favoritism control.
- **Public portal auth attack surface** — rate-limit signups, captcha on application submit, cap uploads per applicant. Email+Google only narrows the surface but email verification and Google anti-abuse must both be enforced.
- **PII** — applicants' household info is sensitive. Rules must prevent cross-applicant reads.
- **Document retention (Confirmed required)** — retain applicant documents and application records for a fixed period after `completed | rejected | cancelled`. Duration pending (see §11 Unresolved). Implementation: don't hard-delete; mark `retainedUntil` timestamp; a scheduled purge job removes past-retention files from Storage and scrubs sensitive fields from Firestore (keeping a tombstone for audit integrity).

## 11. Assumptions & Open Questions

**Confirmed**
- Unified provider model (external + office-funded), hybrid intake, full-shape staged build.
- New Firestore collections (not extending `projectRecords`).
- `applicant` is a new distinct role separate from coordinator/officeAdmin/etc.
- **Applicants must be linked to an existing barangay** in the system (no orphan applicants). Signup/intake requires a barangay selector.
- **Office-funded approval**: OIC signs alone. Finance Officer is an executor, not an approver.
- **Concurrent awards allowed** across different programs for the same applicant (for now). No system-level cross-program exclusivity.
- **Portal auth**: email/password + Google OAuth only. No phone/SMS.
- **Document retention policy required** — records are soft-retained past completion, then purged on schedule (duration TBD).

**Inferred**
- Filipino constituents expect Filipino-localized labels on the portal (Kapitan, Barangay, Tulong Dunong).
- Coordinators are the natural endorsement layer.
- Most external providers won't have an API — submission to them stays manual, tracked via status + notes + attachments.

**Proposed**
- Entity shapes in §5.
- New PageKeys in §4.
- `Scholar` as a lightweight companion record, not a heavy re-model.
- Canonical requirement keys list (indigency_cert, school_cor, etc.) for reporting aggregation.
- Soft-retention mechanism: `retainedUntil` timestamp + scheduled purge job (vs. hard delete).

**Unresolved** (answer before building Phase 2+)
- **Retention duration**: how many years after `completed | rejected | cancelled` before purge? Common anchors: 5, 7, or 10 years. Pick one before writing the purge rule.

**Deferred**
- Online application portal (moved to Phase 4, after staff-entry is proven).
- Academic term tracking (GPA uploads over time).
- Alumni tracking.
- Automated eligibility scoring.
- Bank payout integration.
- Cross-program exclusivity rules (revisit if fairness policy tightens).

## 12. Build Phases

**Phase 1 — Prerequisites (small, do before coding the module)**
- Add `applicant` role to `UserRole` union.
- Add 4 new `PageKey`s (`scholarship_providers`, `scholarship_applications`, `scholarship_scholars`, `scholarship_portal`) to access.ts + presets.
- Retire legacy `UserProfile.roles/permissions` fields (from parent blueprint Phase 0) — reduces risk of the new role mis-routing.
- Add district-scope assertion helper.
- Route: `fullstack-engineer`.

**Phase 2 — Provider & Program configuration**
- Collections: `scholarshipProviders`, `scholarshipPrograms`.
- Staff CRUD UI at `/scholarship/providers` and `/scholarship/programs`.
- Requirement spec editor.
- No applications yet.
- Route: `fullstack-engineer`, `ui-ux-design` (program card), `firestore-rules-check`.

**Phase 3 — Staff-entered applications + review**
- Collections: `applicants`, `applications`, `scholars`.
- Staff intake form, requirement upload, review drawer, status transitions, slot commitment transaction.
- Scholars tab (read from applications + scholars collections).
- Route: `fullstack-engineer`, `ui-ux-design`, `qa-tester` (status machine edge cases), `firestore-rules-check`.

**Phase 4 — Public applicant portal**
- New route group `(portal)`, applicant auth flow, self-registration, browse/apply, "claim existing record" OTP flow.
- Abuse controls: captcha, rate limits, file caps.
- Route: `ui-ux-design` (lead), `fullstack-engineer`, `qa-tester`, `firestore-rules-check`.

**Phase 5 — Budget wiring for office-funded**
- Ties into the parent blueprint's Budget module. `fundingSource === "office"` triggers Commitment→Disbursement→Reconciliation.
- Route: `accounting-systems` (design), `fullstack-engineer`, `qa-tester`.

**Phase 6 — Reporting & exports**
- Per-provider award roll-up, per-barangay beneficiary counts, checklist-completion analytics.
- Route: `data-flow-optimizer`, `fullstack-engineer`.

## 13. Skill Routing
| Area | Skill | Why |
|------|-------|-----|
| Phase 1 role/PageKey prerequisites | `fullstack-engineer` | Touches access.ts, types.ts, server actions |
| Firestore rules for all new collections | `firestore-rules-check` | Prevent cross-applicant reads, enforce status transitions |
| Provider/Program CRUD + review UIs | `fullstack-engineer` | Standard pattern, reuses server-action + actorToken flow |
| Applicant portal (Phase 4) | `ui-ux-design` first, then `fullstack-engineer` | New UX surface, mobile-first, public-facing |
| Slot commitment / reversal logic | `accounting-systems` | Ledger-discipline thinking even before Budget wiring |
| Budget wiring (Phase 5) | `accounting-systems` + `fullstack-engineer` | Ledger correctness |
| Projections for Scholars tab + reports | `data-flow-optimizer` | Authoritative roster vs. query-time joins |
| Functional QA per phase | `qa-tester` | Status machine + permission matrix are the risky parts |
| Business copy (requirement labels, portal microcopy) | `docs-ready` | Applicant-facing tone matters |

## 14. Answer to "should we do user/role first?"
Do **Phase 1 of this blueprint** (role + PageKey additions + legacy cleanup). That IS the targeted user/role work — driven by a concrete module's needs, not speculation. A broader user/role overhaul beyond that isn't warranted yet; wait until a second new module (Budget, Infrastructure milestones) surfaces additional gaps.

## 15. Single Recommended Next Step
Four of five Unresolved items are now **Confirmed** (see §11). Only the **retention duration** (5 / 7 / 10 years) remains — and that does not block Phase 1 or Phase 2, only the purge rule in late Phase 3. Green-light **Phase 1** (role + PageKey + legacy `UserProfile` cleanup) and route to `fullstack-engineer`. Decide retention duration before Phase 3 ships.
